"""Environment configuration. Production uses Secure same-site cookies and a persistent DB."""
from __future__ import annotations
import os
from dataclasses import dataclass
from pathlib import Path
BASE_DIR=Path(__file__).resolve().parent

def _load_dotenv(path: Path):
    if not path.is_file(): return
    for raw in path.read_text(encoding='utf-8').splitlines():
        line=raw.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        key,_,value=line.partition('=');value=value.strip()
        if len(value)>=2 and value[0]==value[-1] and value[0] in "\"'":value=value[1:-1]
        os.environ.setdefault(key.strip(),value)
_load_dotenv(BASE_DIR/'.env')

def _integer(name,default,minimum=1):
    try:return max(minimum,int(os.getenv(name,default)))
    except ValueError:raise RuntimeError(f'{name} must be an integer') from None

@dataclass(frozen=True)
class Settings:
    database_path: Path
    cors_origins: tuple[str,...]
    session_expire_minutes: int=720
    rate_limit_per_minute: int=120
    auth_rate_limit_per_minute: int=10
    trust_proxy: bool=False
    environment: str='development'
    static_dir: Path|None=None
    password_iterations: int=600_000

    @classmethod
    def from_env(cls):
        environment=os.getenv('ENV','development').strip().lower()
        if environment not in {'development','production','test'}:raise RuntimeError('ENV must be development, test or production')
        raw_db=os.getenv('DATABASE_PATH','').strip()
        if environment=='production' and (not raw_db or os.getenv('VERCEL')):
            raise RuntimeError('Production requires DATABASE_PATH on persistent storage, not ephemeral serverless SQLite.')
        path=Path(raw_db) if raw_db else BASE_DIR/'data'/'signbridge.db'
        if not path.is_absolute():path=(BASE_DIR/path).resolve()
        cors=tuple(x.strip() for x in os.getenv('CORS_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(',') if x.strip())
        if '*' in cors:raise RuntimeError('Wildcard CORS is not allowed for cookie sessions.')
        iterations=_integer('PASSWORD_ITERATIONS',600_000)
        if environment=='production' and iterations<600_000:raise RuntimeError('Production password work factor must be at least 600000.')
        dist=BASE_DIR.parent/'frontend'/'dist'
        return cls(database_path=path,cors_origins=cors,session_expire_minutes=_integer('SESSION_EXPIRE_MINUTES',720),
                   rate_limit_per_minute=_integer('RATE_LIMIT_PER_MINUTE',120),auth_rate_limit_per_minute=_integer('AUTH_RATE_LIMIT_PER_MINUTE',10),
                   trust_proxy=os.getenv('TRUST_PROXY','').lower() in {'1','true','yes'},environment=environment,
                   static_dir=dist if (dist/'index.html').is_file() else None,password_iterations=iterations)
