import { Global, Module } from '@nestjs/common';
import { WorkingHoursPolicy } from './policies/working-hours.policy';
import { ApplyRateLimitPolicy } from './policies/apply-rate-limit.policy';
import { ActionPacingPolicy } from './policies/action-pacing.policy';

@Global()
@Module({
  providers: [WorkingHoursPolicy, ApplyRateLimitPolicy, ActionPacingPolicy],
  exports: [WorkingHoursPolicy, ApplyRateLimitPolicy, ActionPacingPolicy],
})
export class HardeningModule {}
