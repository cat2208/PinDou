/**
 * abs-url.interceptor.ts 全局绝对 URL 转换
 *
 * 后端静态资源（uploads/ 图纸产物、public/images/ 站点图）一直以相对路径
 * （/uploads/xxx、/images/xxx）返回。小程序 <image> 会把 "/xxx" 解析成开发者工具
 * 本地路径导致 404，PC 管理后台同源页面也会因跨域取图失败。
 * 这里在响应层统一把相对资源路径转成绝对 URL（http://host:3100/xxx），
 * 前端各页面无需再手动拼接，生产环境走 Nginx 域名时自动跟随请求 host。
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const RESOURCE_PREFIXES = ['/uploads/', '/images/'];

@Injectable()
export class AbsUrlInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const host = req && req.headers && (req.headers.host as string);
    const base = host && /^https?:\/\//.test(req.protocol || '')
      ? `${req.protocol}://${host}`
      : `http://${host || '127.0.0.1'}`;
    return next.handle().pipe(map((data) => this.abs(data, base)));
  }

  /** 递归把匹配前缀的字符串转为绝对 URL（幂等：已是 http/wxfile 开头的原样返回） */
  private abs(v: unknown, base: string): unknown {
    if (typeof v === 'string') {
      if (/^https?:\/\//.test(v) || v.indexOf('wxfile://') === 0) return v;
      for (const p of RESOURCE_PREFIXES) {
        if (v.indexOf(p) === 0) return base + v;
      }
      return v;
    }
    if (Array.isArray(v)) return v.map((x) => this.abs(x, base));
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>)) {
        out[k] = this.abs((v as Record<string, unknown>)[k], base);
      }
      return out;
    }
    return v;
  }
}