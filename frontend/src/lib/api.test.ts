import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api, setUnauthorizedHandler, ApiError } from './api'

describe('cookie API',() => {
  beforeEach(() => {vi.restoreAllMocks();setUnauthorizedHandler(null)})
  it('uses cookies and CSRF header, never a JS-readable access token',async () => {
    const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({user:{id:'a'}})))
    await api.login('a@example.com','password123')
    const options=fetcher.mock.calls[0][1]
    expect(options?.credentials).toBe('include')
    expect(options?.headers).toMatchObject({'X-SignBridge':'1','Content-Type':'application/json'})
    expect(options?.headers).not.toHaveProperty('Authorization')
    expect(options?.body).toBe(JSON.stringify({email:'a@example.com',password:'password123'}))
  })
  it('clears authenticated state on 401, but not a wrong-password response',async () => {
    const clear=vi.fn();setUnauthorizedHandler(clear)
    vi.spyOn(globalThis,'fetch').mockImplementation(async () => new Response(JSON.stringify({detail:'denied'}),{status:401}))
    await expect(api.login('a@example.com','bad')).rejects.toThrow('denied')
    expect(clear).not.toHaveBeenCalled()
    await expect(api.me()).rejects.toBeInstanceOf(ApiError)
    expect(clear).toHaveBeenCalledOnce()
  })
  it('paginates history export beyond the recent 30 records',async () => {
    const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async input => {
      const offset=new URL(String(input),'http://local').searchParams.get('offset')
      return new Response(JSON.stringify(offset==='0'?Array.from({length:100},(_,i) => ({id:String(i)})):[{id:'100'}]))
    })
    const rows=await api.allTranslations()
    expect(rows).toHaveLength(101)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(String(fetcher.mock.calls[1][0])).toContain('offset=100')
  })
  it('attaches feedback to its actual translation ID',async () => {
    const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{}'))
    await api.sendFeedback('wrong video','translation-1')
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({message:'wrong video',translation_id:'translation-1'})
  })
})
