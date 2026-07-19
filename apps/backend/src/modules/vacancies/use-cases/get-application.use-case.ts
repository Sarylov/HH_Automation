import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ApplicationRepository,
  type ApplicationWithVacancy,
} from '../repositories/application.repository';

@Injectable()
export class GetApplicationUseCase {
  private readonly logger = new Logger(GetApplicationUseCase.name);

  constructor(private readonly applications: ApplicationRepository) {}

  async execute(id: string): Promise<ApplicationWithVacancy> {
    this.logger.log({ msg: 'Get application', id });
    const row = await this.applications.findByIdWithVacancy(id);
    if (!row) {
      throw new NotFoundException(`Application ${id} not found`);
    }
    return row;
  }
}
