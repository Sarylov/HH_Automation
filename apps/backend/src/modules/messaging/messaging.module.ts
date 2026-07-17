import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatThreadRepository } from './repositories/chat-thread.repository';
import { ChatMessageRepository } from './repositories/chat-message.repository';
import { FollowUpStateRepository } from './repositories/follow-up-state.repository';
import { ClassifyChatMessageService } from './services/classify-chat-message.service';
import { ProcessChatsUseCase } from './use-cases/process-chats.use-case';
import { ProcessFollowUpsUseCase } from './use-cases/process-follow-ups.use-case';

@Module({
  imports: [AuthModule],
  providers: [
    ChatThreadRepository,
    ChatMessageRepository,
    FollowUpStateRepository,
    ClassifyChatMessageService,
    ProcessChatsUseCase,
    ProcessFollowUpsUseCase,
  ],
  exports: [ProcessChatsUseCase, ProcessFollowUpsUseCase],
})
export class MessagingModule {}
