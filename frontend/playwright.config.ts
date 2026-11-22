import { defineConfig } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const data=process.env.SB_E2E_DATA || mkdtempSync(join(tmpdir(),'signbridge-e2e-'))
process.env.SB_E2E_DATA=data
const smtp=process.env.MAILPIT_BIN ? {SMTP_HOST:'127.0.0.1',SMTP_PORT:'11025',SMTP_STARTTLS:'0',SMTP_DEMO:'1',MAIL_FROM:'SignBridge Demo <no-reply@signbridge.test>'} : {}
const appServer={command:`cd ../backend && ${process.env.PYTHON || 'python'} -m uvicorn main:app --host 127.0.0.1 --port 8099`,url:'http://127.0.0.1:8099/api/health',reuseExistingServer:false,
    env:{DATABASE_PATH:join(data,'app.db'),ENV:'development',PASSWORD_ITERATIONS:'1000',RATE_LIMIT_PER_MINUTE:'10000',AUTH_RATE_LIMIT_PER_MINUTE:'1000',CORS_ORIGINS:'http://127.0.0.1:8099',APP_URL:'http://127.0.0.1:8099',...smtp}}
export default defineConfig({
  testDir:'./e2e',fullyParallel:false,workers:1,timeout:45000,
  use:{baseURL:'http://127.0.0.1:8099',headless:true,viewport:{width:1440,height:1000},trace:'retain-on-failure'},
  webServer:process.env.MAILPIT_BIN ? [
    {command:`${process.env.MAILPIT_BIN} --listen 127.0.0.1:18025 --smtp 127.0.0.1:11025 --disable-version-check --smtp-disable-rdns`,url:'http://127.0.0.1:18025',reuseExistingServer:false},appServer,
  ] : appServer,})
