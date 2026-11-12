import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Not, Repository } from 'typeorm';
import { Address } from './entities/address.entity';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { Users } from 'src/users/entities/users.entity';

export const MAX_ADDRESSES = 10;

/** Contract `Address`. */
export type AddressView = {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  addressLine: string;
  area: string | null;
  city: string;
  postalCode: string | null;
  isDefault: boolean;
  isInsideDhaka: boolean;
};

/** What an order stores (contract: `Omit<Address, "id" | "isDefault">`). */
export type AddressSnapshot = Omit<AddressView, 'id' | 'isDefault'>;

/** Shipping zone: the city mentions Dhaka ("Dhaka", "dhaka city", "Dhaka North"). */
export const isInsideDhaka = (city: string) => /\bdhaka\b/i.test(city);

const emptyToNull = (v: string | null | undefined) =>
  v === undefined ? undefined : v === null || v === '' ? null : v;

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address) private readonly repo: Repository<Address>,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  /** Default first, then newest. */
  async list(userId: string): Promise<AddressView[]> {
    const rows = await this.repo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
    return rows.map(toView);
  }

  async create(userId: string, dto: CreateAddressDto): Promise<AddressView> {
    const count = await this.repo.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) {
      throw new BadRequestException(
        `You can save up to ${MAX_ADDRESSES} addresses; delete one first`,
      );
    }
    const makeDefault = count === 0 || dto.isDefault === true;

    const saved = await this.repo.manager.transaction(async (m) => {
      if (makeDefault) await this.clearDefault(m, userId);
      return m.save(
        m.create(Address, {
          userId,
          label: emptyToNull(dto.label) ?? null,
          fullName: dto.fullName,
          phone: dto.phone,
          addressLine: dto.addressLine,
          area: emptyToNull(dto.area) ?? null,
          city: dto.city,
          postalCode: emptyToNull(dto.postalCode) ?? null,
          isDefault: makeDefault,
        }),
      );
    });
    await this.log(
      userId,
      ActivityType.ADDRESS_ADD,
      `added address ${saved.id}`,
    );
    return toView(saved);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAddressDto,
  ): Promise<AddressView> {
    const address = await this.findOwn(userId, id);
    if (dto.isDefault === false && address.isDefault) {
      throw new BadRequestException(
        'This is your default address; make another address the default instead',
      );
    }

    for (const key of ['fullName', 'phone', 'addressLine', 'city'] as const) {
      if (dto[key] !== undefined) address[key] = dto[key];
    }
    for (const key of ['label', 'area', 'postalCode'] as const) {
      const v = emptyToNull(dto[key]);
      if (v !== undefined) address[key] = v;
    }

    const saved = await this.repo.manager.transaction(async (m) => {
      if (dto.isDefault === true && !address.isDefault) {
        await this.clearDefault(m, userId);
        address.isDefault = true;
      }
      return m.save(address);
    });
    await this.log(
      userId,
      ActivityType.ADDRESS_UPDATE,
      `updated address ${id}`,
    );
    return toView(saved);
  }

  /** Deleting the default promotes the newest remaining address. Past orders keep their snapshot. */
  async remove(userId: string, id: string): Promise<{ success: true }> {
    const address = await this.findOwn(userId, id);
    await this.repo.manager.transaction(async (m) => {
      await m.delete(Address, { id });
      if (address.isDefault) {
        const next = await m.findOne(Address, {
          where: { userId, id: Not(id) },
          order: { createdAt: 'DESC' },
        });
        if (next) await m.update(Address, { id: next.id }, { isDefault: true });
      }
    });
    await this.log(
      userId,
      ActivityType.ADDRESS_DELETE,
      `deleted address ${id}`,
    );
    return { success: true };
  }

  async setDefault(userId: string, id: string): Promise<AddressView[]> {
    const address = await this.findOwn(userId, id);
    if (!address.isDefault) {
      await this.repo.manager.transaction(async (m) => {
        await this.clearDefault(m, userId);
        await m.update(Address, { id }, { isDefault: true });
      });
      await this.log(
        userId,
        ActivityType.ADDRESS_UPDATE,
        `made address ${id} the default`,
      );
    }
    return this.list(userId);
  }

  // ---------- used by orders ----------

  async findOwn(userId: string, id: string): Promise<Address> {
    const address = await this.repo.findOne({ where: { id, userId } });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  /** The user's default address, or null. */
  findDefault(userId: string): Promise<Address | null> {
    return this.repo.findOne({ where: { userId, isDefault: true } });
  }

  snapshot(address: Address): AddressSnapshot {
    const v = toView(address);
    return {
      label: v.label,
      fullName: v.fullName,
      phone: v.phone,
      addressLine: v.addressLine,
      area: v.area,
      city: v.city,
      postalCode: v.postalCode,
      isInsideDhaka: v.isInsideDhaka,
    };
  }

  // ---------- helpers ----------

  private clearDefault(m: EntityManager, userId: string) {
    return m.update(Address, { userId, isDefault: true }, { isDefault: false });
  }

  private log(userId: string, activity: ActivityType, what: string) {
    return this.activityLogs.createActivityLog({
      activity,
      description: `User ${userId} ${what}`,
      user: { id: userId } as Users,
    });
  }
}

export function toView(a: Address): AddressView {
  return {
    id: a.id,
    label: a.label,
    fullName: a.fullName,
    phone: a.phone,
    addressLine: a.addressLine,
    area: a.area,
    city: a.city,
    postalCode: a.postalCode,
    isDefault: a.isDefault,
    isInsideDhaka: isInsideDhaka(a.city),
  };
}
