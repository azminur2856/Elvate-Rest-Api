import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import type { AuthRequest } from 'src/common/auth-user';

/** The caller's own saved addresses (BE-14). */
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@Req() req: AuthRequest) {
    return this.addresses.list(req.user.id);
  }

  @Post()
  create(@Body() dto: CreateAddressDto, @Req() req: AuthRequest) {
    return this.addresses.create(req.user.id, dto);
  }

  @Patch(':id/default')
  setDefault(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.addresses.setDefault(req.user.id, id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
    @Req() req: AuthRequest,
  ) {
    return this.addresses.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.addresses.remove(req.user.id, id);
  }
}
