import { render,screen,fireEvent } from '@testing-library/react'
import { describe,it,expect,vi } from 'vitest'
import { VideoSequence } from './SignVideo'
import type { Sign } from '../lib/types'
const signs: Sign[]=['صباح الخير','تمام'].map((gloss,i) => ({id:String(i),gloss,category:'greetings',media_url:`/media/${i}.mp4`,media_type:'video',source_url:'https://data.mendeley.com/datasets/39tbt2jd7r/1',license:'CC BY 4.0',attribution:'Dataset authors'}))
describe('real video sequence',() => {
  it('loads media URLs, advances and preserves provenance',() => {
    vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue()
    render(<VideoSequence clips={signs}/>)
    expect(screen.getByLabelText('إشارة صباح الخير')).toHaveAttribute('src','/media/0.mp4')
    fireEvent.click(screen.getByRole('button',{name:'التالي'}))
    expect(screen.getByLabelText('إشارة تمام')).toHaveAttribute('src','/media/1.mp4')
    expect(screen.getByRole('link',{name:'مصدر الفيديو'})).toHaveAttribute('href',signs[0].source_url)
  })
  it('does not invent media for an empty result',() => {
    render(<VideoSequence clips={[]}/>)
    expect(screen.getByText('لا توجد فيديوهات مطابقة.')).toBeVisible()
    expect(document.querySelector('video')).toBeNull()
  })
})
