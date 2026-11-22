"""SQLite-compatible Turso adapter using stateful HTTPS Hrana transactions."""
from __future__ import annotations
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator

import httpx
import base64

from database import MIGRATIONS_DIR, statements


class Row:
    """Subset of sqlite3.Row: access by column name or position; dict() friendly."""
    __slots__ = ('_cols', '_vals')

    def __init__(self, cols, vals):
        self._cols = cols
        self._vals = vals

    def __getitem__(self, key):
        if isinstance(key, str):
            return self._vals[self._cols.index(key)]
        return self._vals[key]

    def keys(self):
        return list(self._cols)

    def __iter__(self):
        return iter(self._vals)

    def __len__(self):
        return len(self._vals)


class Result:
    def __init__(self, cols, rows, rowcount):
        self._cols = cols
        self._rows = rows
        self.rowcount = rowcount

    def __iter__(self):
        return iter(self.fetchall())

    def fetchone(self):
        return Row(self._cols, self._rows[0]) if self._rows else None

    def fetchall(self):
        return [Row(self._cols, row) for row in self._rows]


def _convert_error(exc):
    message = str(exc)
    upper = message.upper()
    if 'UNIQUE' in upper or 'CONSTRAINT' in upper:
        return sqlite3.IntegrityError(message)
    return sqlite3.OperationalError(message)


def _https_url(url):
    for scheme in ('libsql://', 'wss://'):
        if url.startswith(scheme):
            return 'https://' + url[len(scheme):]
    return url


def _encode(value):
    if value is None: return {'type': 'null'}
    if isinstance(value, (bool, int)): return {'type': 'integer', 'value': str(int(value))}
    if isinstance(value, float): return {'type': 'float', 'value': value}
    if isinstance(value, bytes): return {'type': 'blob', 'base64': base64.b64encode(value).decode()}
    return {'type': 'text', 'value': str(value)}


def _decode(value):
    kind = value['type']
    if kind == 'null': return None
    if kind == 'integer': return int(value['value'])
    if kind == 'float': return float(value['value'])
    if kind == 'blob': return base64.b64decode(value['base64'])
    return value['value']


class TursoConnection:
    """One remote stream and transaction, preserving reads, rollback and locks."""
    def __init__(self, client, url):
        self._client = client
        self._url = url.rstrip('/') + '/v2/pipeline'
        self._baton = None
        self._active = False

    def _execute(self, sql, params=()):
        payload = {'requests': [{'type': 'execute', 'stmt': {
            'sql': sql, 'args': [_encode(p) for p in params], 'want_rows': True}}]}
        if self._baton: payload['baton'] = self._baton
        response = self._client.post(self._url, json=payload)
        response.raise_for_status()
        data = response.json()
        self._baton = data.get('baton')
        result = data['results'][0]
        if result['type'] == 'error':
            error = result['error']
            raise _convert_error(Exception(error.get('code','') + ': ' + error.get('message','Database error')))
        rs = result['response']['result']
        return Result([c['name'] for c in rs['cols']],
                      [[_decode(v) for v in row] for row in rs['rows']],
                      rs['affected_row_count'])

    def execute(self, sql, params=()):
        stripped = sql.strip().upper()
        if stripped.startswith('PRAGMA'): return Result([], [], 0)
        if not self._active:
            self._execute('BEGIN IMMEDIATE')
            self._active = True
        if stripped.startswith('BEGIN'): return Result([], [], 0)
        return self._execute(sql, params)

    def commit(self):
        if self._active:
            self._execute('COMMIT')
            self._active = False

    def rollback(self):
        if self._active:
            self._execute('ROLLBACK')
            self._active = False

    def close(self):
        if self._baton:
            response = self._client.post(self._url, json={'baton': self._baton, 'requests': [{'type': 'close'}]})
            response.raise_for_status()
            self._baton = None


class TursoDatabase:
    def __init__(self, url, auth_token):
        self.url = _https_url(url)
        self.auth_token = auth_token

    def _client(self):
        return httpx.Client(headers={'Authorization': 'Bearer ' + self.auth_token}, timeout=20)

    @contextmanager
    def session(self) -> Iterator[TursoConnection]:
        client = self._client()
        conn = TursoConnection(client, self.url)
        try:
            yield conn
            conn.commit()
        except BaseException:
            try: conn.rollback()
            except Exception: pass
            raise
        finally:
            try: conn.close()
            finally: client.close()

    def migrate(self):
        applied = []
        with self.session() as conn:
            conn.execute('CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY,applied_at TEXT NOT NULL)')
        for path in sorted(MIGRATIONS_DIR.glob('*.sql')):
            with self.session() as conn:
                if conn.execute('SELECT 1 FROM schema_migrations WHERE version=?', (path.name,)).fetchone():
                    continue
                for statement in statements(path.read_text(encoding='utf-8')):
                    conn.execute(statement)
                conn.execute('INSERT INTO schema_migrations VALUES (?,?)', (path.name, datetime.now(timezone.utc).isoformat()))
                applied.append(path.name)
        return applied
