"""Deterministic dictionary playback, not an Egyptian Sign Language grammar model.
The RecognitionProvider contract is intentionally separate: typed text is never recognition.
"""
from __future__ import annotations
import json
import re
import unicodedata
from pathlib import Path
from typing import Protocol

MANIFEST = json.loads((Path(__file__).parent / 'signs.json').read_text(encoding='utf-8'))
SOURCE = 'https://data.mendeley.com/datasets/39tbt2jd7r/1'

def normalize(text: str) -> str:
    text = unicodedata.normalize('NFKC', text).lower()
    text = re.sub('[\u064b-\u065f\u0670\u0640]', '', text)
    text = re.sub('[أإآٱ]', 'ا', text)
    text = text.replace('ى', 'ي')
    return re.sub(r'[^\w\s]', ' ', text, flags=re.UNICODE).strip()

class RecognitionProvider(Protocol):
    """Implement only with a licensed model plus held-out Egyptian signer evaluation.
    Return None on uncertainty. Supply model card, input constraints and evaluation.
    No remote calls or uploads are made by the default application.
    """
    model_card_url: str
    def recognize(self, video: bytes, mime_type: str) -> dict | None: ...

class DictionaryTranslator:
    def __init__(self, manifest=MANIFEST):
        self.index = {}
        for sign in manifest:
            for text in [sign['gloss'], *sign['aliases']]:
                self.index[normalize(text)] = sign
        self.max_words = max(len(k.split()) for k in self.index)

    def translate(self, text: str) -> dict:
        words = normalize(text).split()
        clips, unknown, segments = [], [], []
        pos = 0
        while pos < len(words):
            found = None
            for size in range(min(self.max_words, len(words)-pos), 0, -1):
                phrase = ' '.join(words[pos:pos+size])
                if phrase in self.index:
                    found = self.index[phrase]
                    clips.append(found)
                    segments.append({'kind': 'sign', 'text': phrase, 'sign_id': found['id']})
                    pos += size
                    break
            if found is None:
                unknown.append(words[pos])
                segments.append({'kind': 'unknown', 'text': words[pos]})
                pos += 1
        status = 'dictionary_match' if clips and not unknown else 'partial' if clips else 'unsupported'
        return dict(status=status, clips=clips, unknown=unknown, segments=segments,
                    output_text=' | '.join(s['gloss'] for s in clips) or None,
                    mode='isolated_word_dictionary', source_url=SOURCE,
                    message='فيديوهات كلمات منفصلة من قاموس مصري، وليست ترجمة قواعد جملة. الكلمات الناقصة موضحة. تسميات البيانات لم يراجعها خبير مستقل.')

translator = DictionaryTranslator()

def seed_dictionary(conn):
    from services import now_iso
    conn.execute("UPDATE sign_languages SET status='active' WHERE id='sample-esl'")
    groups = {}
    for sign in MANIFEST:
        groups.setdefault(sign['category'], []).append(sign)
        conn.execute('INSERT OR IGNORE INTO signs(id,language_id,gloss,description,review_status,created_at) VALUES (?,?,?,?,?,?)',
                     (sign['id'],'sample-esl',sign['gloss'],sign['source_label'],sign['review_status'],now_iso()))
        conn.execute('INSERT OR IGNORE INTO sign_media(id,sign_id,media_url,media_type,license,attribution) VALUES (?,?,?,?,?,?)',
                     (sign['id']+'-video',sign['id'],sign['media_url'],'video',sign['license'],sign['attribution']))
    for i,(category,signs) in enumerate(groups.items()):
        lesson_id = f'dictionary-{i+1}'
        conn.execute('INSERT OR IGNORE INTO lessons(id,language_id,title,level,is_sample,published,category,icon,color,position) VALUES (?,?,?,?,?,?,?,?,?,?)',
                     (lesson_id,'sample-esl',category+' بالفيديو','مبتدئ',0,1,category,'🤟','mint',i))
        for n,s in enumerate(signs):
            conn.execute('INSERT OR IGNORE INTO lesson_items(id,lesson_id,position,gloss) VALUES (?,?,?,?)',(lesson_id+'-'+str(n),lesson_id,n,s['gloss']))
        questions=[]
        all_signs=MANIFEST
        for n,s in enumerate(signs):
            options=[s['gloss']]+[x['gloss'] for x in all_signs if x['id']!=s['id']][:3]
            # Deterministic rotation avoids always putting the answer in slot zero.
            k=n%len(options);options=options[k:]+options[:k]
            questions.append(dict(id=str(n),sign_id=s['id'],media_url=s['media_url'],options=options,answer=s['gloss']))
        conn.execute('INSERT OR IGNORE INTO quizzes(id,lesson_id,title,content_json) VALUES (?,?,?,?)',
                     (lesson_id+'-quiz',lesson_id,'اختبار '+category,json.dumps(questions,ensure_ascii=False)))
