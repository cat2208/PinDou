import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser, JwtUser } from '../../common/auth.guard';

@Controller()
export class UserController {
  constructor(private readonly svc: UserService) {}

  @Get('user/info')
  userInfo(@CurrentUser() user: JwtUser) {
    return this.svc.userInfo(user.uid);
  }

  @Post('user/update')
  update(@CurrentUser() user: JwtUser, @Body() body: { nickname?: string; phone?: string; birthday?: string }) {
    return this.svc.updateUser(user.uid, body);
  }

  @Get('user/address/default')
  defaultAddress() {
    return this.svc.defaultAddress();
  }

  @Get('member/info')
  memberInfo(@CurrentUser() user: JwtUser) {
    return this.svc.memberInfo(user.uid);
  }

  @Get('member/points')
  pointLogs(@CurrentUser() user: JwtUser) {
    return this.svc.pointLogs(user.uid);
  }

  @Get('notifications')
  notifications(@CurrentUser() user: JwtUser) {
    return this.svc.notifications(user.uid);
  }
}