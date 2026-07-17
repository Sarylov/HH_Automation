import { ClassifyChatMessageService } from './classify-chat-message.service';
import { ChatClassification } from '@prisma/client';

describe('ClassifyChatMessageService', () => {
  const service = new ClassifyChatMessageService();

  it('detects rejection', () => {
    const result = service.classify(
      'К сожалению, мы выбрали другого кандидата.',
    );
    expect(result.classification).toBe(ChatClassification.REJECTION);
  });

  it('detects interview', () => {
    const result = service.classify(
      'Приглашаем вас на собеседование в Zoom завтра.',
    );
    expect(result.classification).toBe(ChatClassification.INTERVIEW);
  });

  it('detects template salary question', () => {
    const result = service.classify('Какие у вас ожидания по зарплате?');
    expect(result.classification).toBe(ChatClassification.TEMPLATE);
    expect(service.buildTemplateReply('Какие у вас ожидания по зарплате?')).toBeTruthy();
  });

  it('detects AI Q&A for open questions', () => {
    const result = service.classify(
      'Подскажите, пожалуйста, был ли у вас опыт с микрофронтендами?',
    );
    expect(result.classification).toBe(ChatClassification.AI_QA);
  });
});
