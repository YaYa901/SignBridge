"""Pydantic request bodies."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

Text500 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
Text1000 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Password = Annotated[str, Field(min_length=1, max_length=128)]  # not stripped on purpose


class RegisterBody(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: Password
    display_name: Name


class LoginBody(BaseModel):
    email: str = Field(min_length=1, max_length=254)
    password: Password


class ProfileBody(BaseModel):
    display_name: Name


class SettingsBody(BaseModel):
    player_speed: float | None = None
    speech_rate: float | None = None


class ChangePasswordBody(BaseModel):
    current_password: Password
    new_password: Password


class DeleteAccountBody(BaseModel):
    password: Password


class TranslationBody(BaseModel):
    direction: Literal["text_to_sign", "sign_to_text"]
    language_code: Literal["ar-EG-ESL"] = "ar-EG-ESL"
    input_text: Text500


class PhraseBody(BaseModel):
    text: Text500


class ProgressBody(BaseModel):
    progress: float = Field(ge=0, le=1)


class MessageBody(BaseModel):
    text: Text1000
    speaker: Literal["me", "other"] = "me"
    source: Literal["typed", "dictation"] = "typed"


class FeedbackBody(BaseModel):
    translation_id: str | None = Field(default=None, max_length=64)
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=2000)]


class EmailRequestBody(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    purpose: Literal['verify', 'reset']


class EmailActionBody(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    purpose: Literal['verify', 'reset']
    password: str = Field(default='', max_length=128)


class QuizAnswersBody(BaseModel):
    answers: dict[str, str] = Field(max_length=50)
