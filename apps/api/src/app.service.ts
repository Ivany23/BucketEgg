import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return { name: 'BucketEgg Route-to-Market API', status: 'ok', docs: '/docs' };
  }
}
