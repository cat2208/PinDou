import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 统一响应包装：所有成功响应 → { code: 0, msg: 'ok', data: ... }
 * 前端 utils/request.js 已按此契约解析（data.code === 0 时返回 data.data）。
 */
export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        const resp = context.switchToHttp().getResponse();
        if (resp && resp.statusCode === 201) resp.statusCode = 200;
        return { code: 0, msg: 'ok', data };
      }),
    );
  }
}