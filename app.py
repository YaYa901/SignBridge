"""Vercel entrypoint for the explicitly disposable demonstration."""
import sys
import os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'backend'))
if os.getenv('DEMO_MODE') == '1' and os.getenv('VERCEL'):
    host = os.getenv('VERCEL_PROJECT_PRODUCTION_URL') or os.getenv('VERCEL_URL')
    if not host:raise RuntimeError('Vercel deployment URL is required')
    os.environ.setdefault('APP_URL', 'https://' + host)
    os.environ.setdefault('CORS_ORIGINS', os.environ['APP_URL'])
from main import app  # noqa: E402,F401
