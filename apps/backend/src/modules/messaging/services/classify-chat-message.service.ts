import { Injectable } from '@nestjs/common';
import { ChatClassification } from '@prisma/client';

export type ClassificationResult = {
  classification: ChatClassification;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
};

const REJECTION =
  /к\s*сожал|отказ|не\s*(подошл|рассмотр|актуальн)|выбрали\s+друго|не\s+можем\s+предлож|закрыли\s+ваканси|не\s+готовы\s+продолж/i;

const INTERVIEW =
  /собесед|интервью|приглашаем|назнач(им|ить)\s+звонок|zoom|google\s*meet|teams|когда\s+вам\s+удобно|давайте\s+созвон/i;

const TEMPLATE_SALARY = /зарплат|ожидан(ия|иях)\s+по\s+доход|уровень\s+доход|вилка/i;
const TEMPLATE_FORMAT = /формат\s+работ|удал[её]н|офис|гибрид|релокац/i;
const TEMPLATE_START = /когда\s+можете\s+(выйти|начать)|дата\s+выхода|готовность\s+к\s+выходу/i;

@Injectable()
export class ClassifyChatMessageService {
  classify(employerText: string): ClassificationResult {
    const text = employerText.trim();
    if (!text) {
      return {
        classification: ChatClassification.UNKNOWN,
        confidence: 'low',
        reason: 'empty_message',
      };
    }

    if (REJECTION.test(text)) {
      return {
        classification: ChatClassification.REJECTION,
        confidence: 'high',
        reason: 'rejection_keywords',
      };
    }

    if (INTERVIEW.test(text)) {
      return {
        classification: ChatClassification.INTERVIEW,
        confidence: 'high',
        reason: 'interview_keywords',
      };
    }

    if (
      TEMPLATE_SALARY.test(text) ||
      TEMPLATE_FORMAT.test(text) ||
      TEMPLATE_START.test(text)
    ) {
      return {
        classification: ChatClassification.TEMPLATE,
        confidence: 'medium',
        reason: 'template_question',
      };
    }

    if (/\?|пожалуйста|уточн|расскажите|подскажите/.test(text)) {
      return {
        classification: ChatClassification.AI_QA,
        confidence: 'medium',
        reason: 'open_question',
      };
    }

    return {
      classification: ChatClassification.UNKNOWN,
      confidence: 'low',
      reason: 'no_match',
    };
  }

  buildTemplateReply(employerText: string): string | null {
    if (TEMPLATE_SALARY.test(employerText)) {
      return (
        'Здравствуйте! По вилке ориентируюсь на рынок Senior/Lead Frontend ' +
        'и готов обсудить конкретный диапазон на собеседовании, с учётом задач и формата.'
      );
    }
    if (TEMPLATE_FORMAT.test(employerText)) {
      return (
        'Здравствуйте! Предпочтительный формат — удалённо или гибрид. ' +
        'К офису готов при необходимости для ключевых встреч.'
      );
    }
    if (TEMPLATE_START.test(employerText)) {
      return (
        'Здравствуйте! К выходу готов в течение 2 недель после оффера, ' +
        'срок можно согласовать.'
      );
    }
    return null;
  }
}
