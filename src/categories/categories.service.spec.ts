import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { Product } from 'src/products/entities/product.entity';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { Role } from 'src/users/enums/role.enum';

const row = (
  id: string,
  slug: string,
  parentId: string | null,
  sortOrder = 0,
) =>
  ({ id, name: slug, slug, parentId, sortOrder, imageUrl: null }) as Category;

// men ─ men-tshirts ─ men-tshirts-graphic
//     └ men-shirts
// women
const ROWS = [
  row('m', 'men', null, 1),
  row('w', 'women', null, 2),
  row('mt', 'men-tshirts', 'm', 1),
  row('ms', 'men-shirts', 'm', 2),
  row('mtg', 'men-tshirts-graphic', 'mt'),
];

describe('CategoriesService', () => {
  let service: CategoriesService;
  const counts = { getRawMany: jest.fn() };
  const productQb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawMany: (): Promise<unknown> => counts.getRawMany() as Promise<unknown>,
  };
  const repo = {
    find: jest.fn().mockResolvedValue(ROWS),
    findOne: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  };
  const productRepo = {
    createQueryBuilder: jest.fn(() => productQb),
    count: jest.fn(),
  };
  const staff = { id: 's1', role: Role.STAFF };

  beforeEach(async () => {
    jest.clearAllMocks();
    counts.getRawMany.mockResolvedValue([
      { categoryId: 'mtg', count: '2' },
      { categoryId: 'mt', count: '1' },
      { categoryId: 'ms', count: '4' },
    ]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getRepositoryToken(Category), useValue: repo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        {
          provide: ActivityLogsService,
          useValue: { createActivityLog: jest.fn() },
        },
      ],
    }).compile();
    service = moduleRef.get(CategoriesService);
  });

  it('nests the tree and rolls product counts up to every ancestor', async () => {
    const tree = await service.tree();
    expect(tree.map((c) => c.slug)).toEqual(['men', 'women']);
    const men = tree[0];
    expect(men.productCount).toBe(7);
    expect(men.children!.map((c) => [c.slug, c.productCount])).toEqual([
      ['men-tshirts', 3],
      ['men-shirts', 4],
    ]);
    expect(men.children![0].children![0]).toMatchObject({
      slug: 'men-tshirts-graphic',
      productCount: 2,
    });
    expect(tree[1].productCount).toBe(0);
    expect(productQb.where).toHaveBeenCalledWith('p.isActive = true');
  });

  it('scopeIds returns a category and all its descendants', async () => {
    await expect(service.scopeIds('men-tshirts')).resolves.toEqual([
      'mt',
      'mtg',
    ]);
    await expect(service.scopeIds('nope')).resolves.toBeNull();
  });

  it('findBySlug adds a root → self breadcrumb', async () => {
    const c = await service.findBySlug('men-tshirts-graphic');
    expect(c.breadcrumb.map((b) => b.slug)).toEqual([
      'men',
      'men-tshirts',
      'men-tshirts-graphic',
    ]);
  });

  it('refuses to delete a root, a category with children, or one with products', async () => {
    repo.findOne.mockResolvedValueOnce(ROWS[0]);
    await expect(service.remove('m', staff)).rejects.toBeInstanceOf(
      ConflictException,
    );

    repo.findOne.mockResolvedValueOnce(ROWS[2]);
    repo.count.mockResolvedValueOnce(1);
    await expect(service.remove('mt', staff)).rejects.toThrow('1 sub-category');

    repo.findOne.mockResolvedValueOnce(ROWS[3]);
    repo.count.mockResolvedValueOnce(0);
    productRepo.count.mockResolvedValueOnce(4);
    await expect(service.remove('ms', staff)).rejects.toThrow('4 products');
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
