"""FastAPI application, persistent SQLite controls and SPA delivery."""
from __future__ import annotations
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
import accounts
import services
from config import Settings, BASE_DIR
from database import Database
from routes import router
from translation import seed_dictionary

AUTH_PATHS={'/api/auth/login','/api/auth/register','/api/auth/request-email','/api/auth/complete-email'}

def create_app(settings: Settings | None=None) -> FastAPI:
    settings=settings or Settings.from_env()
    if settings.turso_url:
        from turso_db import TursoDatabase
        db=TursoDatabase(settings.turso_url, settings.turso_token)
    else:
        db=Database(settings.database_path)
    @asynccontextmanager
    async def lifespan(_):
        db.migrate()
        with db.session() as conn:
            seed_dictionary(conn)
        yield
    app=FastAPI(title='SignBridge API',version='2.0.0',lifespan=lifespan,docs_url=None,redoc_url=None,
                description='Egyptian isolated-word video dictionary. Camera recognition is not configured.')
    app.state.settings=settings;app.state.db=db
    @app.middleware('http')
    async def protect(request: Request,call_next):
        path=request.url.path
        if path.startswith('/api'):
            if request.method not in {'GET','HEAD','OPTIONS'}:
                origin=request.headers.get('origin')
                allowed=set(settings.cors_origins)|{str(request.base_url).rstrip('/')}
                if (origin and origin not in allowed) or request.headers.get('sec-fetch-site')=='cross-site':
                    return JSONResponse({'detail':'طلب من مصدر غير مسموح.'},status_code=403)
                if request.headers.get('x-signbridge')!='1':
                    return JSONResponse({'detail':'يلزم ترويسة X-SignBridge لمنع الطلبات المزورة.'},status_code=403)
            ip=request.client.host if request.client else 'unknown'
            if settings.trust_proxy:
                ip=request.headers.get('x-forwarded-for','').split(',')[0].strip() or ip
            if request.method!='OPTIONS':
                if not accounts.allow_rate(db,'all',ip,settings.rate_limit_per_minute) or (path in AUTH_PATHS and not accounts.allow_rate(db,'auth',ip,settings.auth_rate_limit_per_minute)):
                    return JSONResponse({'detail':'طلبات كثيرة. حاول بعد دقيقة.'},status_code=429,headers={'Retry-After':'60'})
        response=await call_next(request)
        response.headers.update({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
            'Permissions-Policy':'camera=(self), microphone=(self), geolocation=()',
            'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"})
        if path.startswith('/api') or path.startswith('/account-action'):
            response.headers['Cache-Control']='no-store'
        if settings.environment=='production':
            response.headers['Strict-Transport-Security']='max-age=31536000; includeSubDomains'
        return response
    app.add_middleware(CORSMiddleware,allow_origins=list(settings.cors_origins),allow_credentials=True,
                       allow_methods=['GET','POST','PUT','PATCH','DELETE'],allow_headers=['Content-Type','X-SignBridge'])
    @app.exception_handler(services.ServiceError)
    async def service_error(_,exc):
        return JSONResponse({'detail':exc.message},status_code=exc.status_code)
    @app.exception_handler(RequestValidationError)
    async def validation_error(_,exc):
        return JSONResponse({'detail':'البيانات المدخلة غير صالحة.','fields':['.'.join(str(p) for p in e.get('loc',())[1:]) for e in exc.errors()]},status_code=422)
    app.include_router(router)
    app.mount('/docs-assets',StaticFiles(directory=BASE_DIR/'docs_assets'),name='docs-assets')
    @app.get('/docs',include_in_schema=False,response_class=HTMLResponse)
    def api_docs():
        return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SignBridge API</title><link rel="stylesheet" href="/docs-assets/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="/docs-assets/swagger-ui-bundle.js"></script><script src="/docs-assets/init.js"></script></body></html>'
    app.mount('/media',StaticFiles(directory=BASE_DIR/'media'),name='media')
    if settings.static_dir:
        dist=Path(settings.static_dir).resolve()
        @app.get('/{path:path}',include_in_schema=False)
        def frontend(path: str):
            if path.startswith(('api/','media/')) or path=='api':
                return JSONResponse({'detail':'Not found'},status_code=404)
            candidate=(dist/path).resolve()
            if dist in candidate.parents and candidate.is_file():
                return FileResponse(candidate)
            if '.' in Path(path).name:
                return JSONResponse({'detail':'Not found'},status_code=404)
            return FileResponse(dist/'index.html')
    return app

app=create_app()
