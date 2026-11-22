"""SQLite connections and serialized, transactional schema migrations."""
from __future__ import annotations
import sqlite3
from contextlib import contextmanager
from datetime import datetime,timezone
from pathlib import Path
from typing import Iterator
MIGRATIONS_DIR=Path(__file__).resolve().parent/'migrations'

def statements(script: str):
    buffer=''
    for char in script:
        buffer+=char
        if char==';' and sqlite3.complete_statement(buffer):
            yield buffer
            buffer=''
    if buffer.strip() and any(not line.strip().startswith('--') and line.strip() for line in buffer.splitlines()):
        raise RuntimeError('Migration contains an incomplete SQL statement')

class Database:
    def __init__(self,path: Path):self.path=Path(path)
    def connect(self):
        self.path.parent.mkdir(parents=True,exist_ok=True)
        conn=sqlite3.connect(self.path,timeout=30)
        conn.row_factory=sqlite3.Row
        conn.execute('PRAGMA foreign_keys=ON')
        conn.execute('PRAGMA busy_timeout=30000')
        return conn
    @contextmanager
    def session(self) -> Iterator[sqlite3.Connection]:
        conn=self.connect()
        try:
            yield conn
            conn.commit()
        except BaseException:
            conn.rollback();raise
        finally:conn.close()
    def migrate(self):
        applied=[]
        with self.session() as conn:
            try:
                conn.execute('PRAGMA journal_mode=WAL')
            except sqlite3.OperationalError as exc:
                # A concurrent startup may be switching the journal. Its connection
                # finishes that switch; schema work below still takes a write lock.
                if 'locked' not in str(exc).lower():raise
            conn.execute('CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY,applied_at TEXT NOT NULL)')
        for path in sorted(MIGRATIONS_DIR.glob('*.sql')):
            with self.session() as conn:
                # Check after taking the lock, so another worker cannot apply this version twice.
                conn.execute('BEGIN IMMEDIATE')
                if conn.execute('SELECT 1 FROM schema_migrations WHERE version=?',(path.name,)).fetchone():continue
                for statement in statements(path.read_text(encoding='utf-8')):conn.execute(statement)
                conn.execute('INSERT INTO schema_migrations VALUES (?,?)',(path.name,datetime.now(timezone.utc).isoformat()))
                applied.append(path.name)
        return applied
