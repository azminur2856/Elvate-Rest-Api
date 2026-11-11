/** Demo catalogue for `npm run seed` (BE-22). Prices in BDT. */

export type Garment =
  | 'tshirt'
  | 'shirt'
  | 'pants'
  | 'dress'
  | 'shoe'
  | 'bag'
  | 'cap';

export type SeedCategory = {
  key: string;
  name: string;
  parent: 'men' | 'women' | 'children';
  sortOrder: number;
};

export type SeedProduct = {
  name: string;
  category: string; // SeedCategory.key
  brand: string;
  garment: Garment;
  price: number;
  salePrice?: number;
  material: string;
  care: string;
  description: string;
  specs: Record<string, string>;
  sizes: string[];
  colors: { name: string; hex: string }[];
  featured?: boolean;
  newArrival?: boolean;
};

export const CATEGORIES: SeedCategory[] = [
  { key: 'men-t-shirts', name: 'T-Shirts', parent: 'men', sortOrder: 1 },
  { key: 'men-shirts', name: 'Shirts', parent: 'men', sortOrder: 2 },
  { key: 'men-pants', name: 'Pants', parent: 'men', sortOrder: 3 },
  { key: 'men-shoes', name: 'Shoes', parent: 'men', sortOrder: 4 },
  { key: 'men-accessories', name: 'Accessories', parent: 'men', sortOrder: 5 },
  { key: 'women-dresses', name: 'Dresses', parent: 'women', sortOrder: 1 },
  { key: 'women-tops', name: 'Tops', parent: 'women', sortOrder: 2 },
  { key: 'women-pants', name: 'Pants', parent: 'women', sortOrder: 3 },
  { key: 'women-shoes', name: 'Shoes', parent: 'women', sortOrder: 4 },
  {
    key: 'women-accessories',
    name: 'Accessories',
    parent: 'women',
    sortOrder: 5,
  },
  {
    key: 'children-kids-wear',
    name: 'Kids Wear',
    parent: 'children',
    sortOrder: 1,
  },
  {
    key: 'children-kids-shoes',
    name: 'Kids Shoes',
    parent: 'children',
    sortOrder: 2,
  },
];

const ADULT = ['S', 'M', 'L', 'XL'];
const WAIST = ['30', '32', '34', '36'];
const SHOE = ['40', '41', '42', '43'];
const W_SHOE = ['36', '37', '38', '39'];
const KIDS = ['4-5Y', '6-7Y', '8-9Y'];
const care = {
  cotton:
    'Machine wash cold with like colours. Do not bleach. Tumble dry low. Warm iron.',
  denim: 'Wash inside out in cold water. Hang to dry. Do not bleach.',
  delicate: 'Hand wash cold or dry clean. Dry flat in shade.',
  leather:
    'Wipe with a damp cloth. Keep away from direct heat. Use leather conditioner.',
};

export const PRODUCTS: SeedProduct[] = [
  // ---------- men ----------
  {
    name: 'Classic Crew Neck Tee',
    category: 'men-t-shirts',
    brand: 'Elvate Basics',
    garment: 'tshirt',
    price: 650,
    salePrice: 520,
    material: '100% combed cotton, 180 GSM',
    care: care.cotton,
    description:
      'An everyday crew neck in soft combed cotton. Regular fit with a ribbed collar that keeps its shape wash after wash.',
    specs: {
      Fit: 'Regular',
      Neck: 'Crew',
      Sleeve: 'Short',
      Origin: 'Bangladesh',
    },
    sizes: ADULT,
    colors: [
      { name: 'White', hex: '#f4f4f2' },
      { name: 'Black', hex: '#222222' },
      { name: 'Navy', hex: '#1f2f56' },
    ],
    featured: true,
  },
  {
    name: 'Graphic Print Tee',
    category: 'men-t-shirts',
    brand: 'Urban Thread',
    garment: 'tshirt',
    price: 790,
    material: '100% cotton jersey',
    care: care.cotton,
    description:
      'Relaxed tee with a bold front print inspired by Dhaka street art.',
    specs: { Fit: 'Relaxed', Print: 'Screen print', Sleeve: 'Short' },
    sizes: ADULT,
    colors: [
      { name: 'Charcoal', hex: '#3b3d42' },
      { name: 'Sand', hex: '#d8c7a3' },
    ],
    newArrival: true,
  },
  {
    name: 'Polo Shirt',
    category: 'men-t-shirts',
    brand: 'Elvate Basics',
    garment: 'shirt',
    price: 1150,
    material: 'Cotton pique',
    care: care.cotton,
    description:
      'Breathable pique polo with a two-button placket. Smart enough for the office, easy enough for the weekend.',
    specs: { Fit: 'Regular', Collar: 'Polo', Sleeve: 'Short' },
    sizes: ADULT,
    colors: [
      { name: 'Maroon', hex: '#7a1f2b' },
      { name: 'Sky Blue', hex: '#8ec3e6' },
    ],
  },
  {
    name: 'Oxford Button-Down Shirt',
    category: 'men-shirts',
    brand: 'Rivoli',
    garment: 'shirt',
    price: 1890,
    salePrice: 1590,
    material: '100% cotton oxford',
    care: care.cotton,
    description:
      'A wardrobe staple: soft oxford weave, button-down collar and a tailored fit.',
    specs: { Fit: 'Tailored', Collar: 'Button-down', Sleeve: 'Long' },
    sizes: ADULT,
    colors: [
      { name: 'Light Blue', hex: '#a9c6e8' },
      { name: 'White', hex: '#f6f6f4' },
    ],
    featured: true,
  },
  {
    name: 'Linen Summer Shirt',
    category: 'men-shirts',
    brand: 'Rivoli',
    garment: 'shirt',
    price: 2250,
    material: '55% linen, 45% cotton',
    care: care.delicate,
    description: 'Lightweight linen blend that stays cool in humid weather.',
    specs: { Fit: 'Relaxed', Collar: 'Camp', Sleeve: 'Short' },
    sizes: ADULT,
    colors: [
      { name: 'Olive', hex: '#6b7448' },
      { name: 'Beige', hex: '#e2d5bb' },
    ],
    newArrival: true,
  },
  {
    name: 'Slim Fit Chinos',
    category: 'men-pants',
    brand: 'Elvate Basics',
    garment: 'pants',
    price: 1650,
    material: '98% cotton, 2% elastane',
    care: care.cotton,
    description: 'Stretch twill chinos with a slim, tapered leg.',
    specs: { Fit: 'Slim', Rise: 'Mid', Closure: 'Zip fly' },
    sizes: WAIST,
    colors: [
      { name: 'Khaki', hex: '#b9a37a' },
      { name: 'Navy', hex: '#202c48' },
    ],
  },
  {
    name: 'Stretch Denim Jeans',
    category: 'men-pants',
    brand: 'Indigo Co.',
    garment: 'pants',
    price: 2390,
    salePrice: 1990,
    material: '92% cotton, 6% polyester, 2% elastane',
    care: care.denim,
    description: 'Mid-wash denim with just enough stretch for all-day comfort.',
    specs: { Fit: 'Straight', Wash: 'Mid blue', Rise: 'Mid' },
    sizes: WAIST,
    colors: [
      { name: 'Mid Blue', hex: '#4a6a9c' },
      { name: 'Black', hex: '#1d1d22' },
    ],
    featured: true,
  },
  {
    name: 'Everyday Sneakers',
    category: 'men-shoes',
    brand: 'Stride',
    garment: 'shoe',
    price: 3200,
    material: 'Canvas upper, rubber sole',
    care: care.leather,
    description: 'Clean low-top sneakers with a cushioned insole.',
    specs: { Upper: 'Canvas', Sole: 'Vulcanised rubber', Closure: 'Lace-up' },
    sizes: SHOE,
    colors: [
      { name: 'White', hex: '#f2f2f0' },
      { name: 'Black', hex: '#202020' },
    ],
    newArrival: true,
  },
  {
    name: 'Leather Loafers',
    category: 'men-shoes',
    brand: 'Stride',
    garment: 'shoe',
    price: 4500,
    material: 'Genuine leather',
    care: care.leather,
    description:
      'Hand-finished leather loafers for weddings, Eid and the office.',
    specs: { Upper: 'Leather', Sole: 'TPR', Closure: 'Slip-on' },
    sizes: SHOE,
    colors: [{ name: 'Brown', hex: '#6a4128' }],
  },
  {
    name: 'Canvas Baseball Cap',
    category: 'men-accessories',
    brand: 'Urban Thread',
    garment: 'cap',
    price: 550,
    material: '100% cotton canvas',
    care: care.cotton,
    description: 'Six-panel cap with an adjustable strap.',
    specs: { Size: 'Adjustable', Panel: '6' },
    sizes: ['One size'],
    colors: [
      { name: 'Black', hex: '#222' },
      { name: 'Olive', hex: '#5f6a3d' },
    ],
  },

  // ---------- women ----------
  {
    name: 'Floral Midi Dress',
    category: 'women-dresses',
    brand: 'Bloom',
    garment: 'dress',
    price: 2690,
    salePrice: 2190,
    material: '100% viscose',
    care: care.delicate,
    description: 'Flowing midi dress in a soft floral print with a tie waist.',
    specs: { Length: 'Midi', Sleeve: 'Short', Neck: 'V-neck' },
    sizes: ['XS', 'S', 'M', 'L'],
    colors: [
      { name: 'Rose', hex: '#d67d8f' },
      { name: 'Sage', hex: '#9fb39a' },
    ],
    featured: true,
  },
  {
    name: 'Cotton Shirt Dress',
    category: 'women-dresses',
    brand: 'Bloom',
    garment: 'dress',
    price: 2350,
    material: '100% cotton poplin',
    care: care.cotton,
    description: 'Crisp poplin shirt dress with a self belt and side pockets.',
    specs: { Length: 'Knee', Sleeve: 'Three-quarter' },
    sizes: ['XS', 'S', 'M', 'L'],
    colors: [
      { name: 'Mustard', hex: '#d1a237' },
      { name: 'White', hex: '#f6f6f4' },
    ],
    newArrival: true,
  },
  {
    name: 'Embroidered Kurti',
    category: 'women-tops',
    brand: 'Nakshi',
    garment: 'dress',
    price: 1850,
    material: 'Cotton slub',
    care: care.delicate,
    description:
      'Straight-cut kurti with hand-guided nakshi embroidery at the neckline.',
    specs: { Length: 'Knee', Sleeve: 'Three-quarter', Work: 'Embroidery' },
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [
      { name: 'Teal', hex: '#2f7f7a' },
      { name: 'Maroon', hex: '#7a1f2b' },
    ],
    featured: true,
  },
  {
    name: 'Relaxed Linen Top',
    category: 'women-tops',
    brand: 'Bloom',
    garment: 'tshirt',
    price: 1290,
    material: '100% linen',
    care: care.delicate,
    description: 'Boxy linen top that pairs with everything.',
    specs: { Fit: 'Relaxed', Sleeve: 'Short' },
    sizes: ['XS', 'S', 'M', 'L'],
    colors: [
      { name: 'Ivory', hex: '#efe9dc' },
      { name: 'Dusty Blue', hex: '#8aa2bd' },
    ],
  },
  {
    name: 'High-Rise Wide Leg Pants',
    category: 'women-pants',
    brand: 'Indigo Co.',
    garment: 'pants',
    price: 1990,
    material: 'Polyester-viscose crepe',
    care: care.delicate,
    description: 'Fluid wide-leg trousers with a flattering high rise.',
    specs: { Fit: 'Wide leg', Rise: 'High' },
    sizes: ['XS', 'S', 'M', 'L'],
    colors: [
      { name: 'Black', hex: '#1e1e1e' },
      { name: 'Camel', hex: '#b88b5a' },
    ],
  },
  {
    name: 'Skinny Jeans',
    category: 'women-pants',
    brand: 'Indigo Co.',
    garment: 'pants',
    price: 2190,
    salePrice: 1790,
    material: '90% cotton, 8% polyester, 2% elastane',
    care: care.denim,
    description: 'Super-stretch skinny jeans that keep their shape.',
    specs: { Fit: 'Skinny', Wash: 'Dark' },
    sizes: ['26', '28', '30', '32'],
    colors: [{ name: 'Dark Blue', hex: '#2b3b63' }],
  },
  {
    name: 'Block Heel Sandals',
    category: 'women-shoes',
    brand: 'Stride',
    garment: 'shoe',
    price: 2790,
    material: 'PU leather',
    care: care.leather,
    description: 'Comfortable 5 cm block heels with an ankle strap.',
    specs: { Heel: '5 cm block', Closure: 'Buckle' },
    sizes: W_SHOE,
    colors: [
      { name: 'Nude', hex: '#d9b59a' },
      { name: 'Black', hex: '#202020' },
    ],
    newArrival: true,
  },
  {
    name: 'Woven Tote Bag',
    category: 'women-accessories',
    brand: 'Nakshi',
    garment: 'bag',
    price: 1490,
    material: 'Jute and cotton',
    care: care.delicate,
    description: 'Handwoven jute tote with cotton lining and an inside pocket.',
    specs: { Dimensions: '40 x 32 x 12 cm', Closure: 'Magnetic' },
    sizes: ['One size'],
    colors: [{ name: 'Natural', hex: '#c8a978' }],
  },
  {
    name: 'Silk Blend Scarf',
    category: 'women-accessories',
    brand: 'Bloom',
    garment: 'bag',
    price: 990,
    material: '30% silk, 70% viscose',
    care: care.delicate,
    description: 'Lightweight printed scarf, 180 x 70 cm.',
    specs: { Dimensions: '180 x 70 cm' },
    sizes: ['One size'],
    colors: [
      { name: 'Coral', hex: '#e07a5f' },
      { name: 'Emerald', hex: '#2a7f62' },
    ],
  },

  // ---------- children ----------
  {
    name: 'Kids Cartoon Tee',
    category: 'children-kids-wear',
    brand: 'Little Elvate',
    garment: 'tshirt',
    price: 450,
    material: '100% cotton',
    care: care.cotton,
    description: 'Soft cotton tee with a playful print. Tag-free neck.',
    specs: { Fit: 'Regular', Sleeve: 'Short' },
    sizes: KIDS,
    colors: [
      { name: 'Yellow', hex: '#f2c94c' },
      { name: 'Sky Blue', hex: '#7cc3ea' },
    ],
    featured: true,
  },
  {
    name: 'Kids Denim Shorts',
    category: 'children-kids-wear',
    brand: 'Little Elvate',
    garment: 'pants',
    price: 690,
    material: 'Cotton denim',
    care: care.denim,
    description: 'Pull-on denim shorts with an elastic waist.',
    specs: { Waist: 'Elastic' },
    sizes: KIDS,
    colors: [{ name: 'Light Blue', hex: '#8fb2d8' }],
  },
  {
    name: 'Girls Party Frock',
    category: 'children-kids-wear',
    brand: 'Little Elvate',
    garment: 'dress',
    price: 1350,
    salePrice: 1090,
    material: 'Polyester tulle, cotton lining',
    care: care.delicate,
    description: 'Twirly party frock with a satin bow and soft lining.',
    specs: { Length: 'Knee', Lining: 'Cotton' },
    sizes: KIDS,
    colors: [
      { name: 'Pink', hex: '#f2a7c3' },
      { name: 'Lilac', hex: '#b9a6dd' },
    ],
    newArrival: true,
  },
  {
    name: 'Kids Velcro Sneakers',
    category: 'children-kids-shoes',
    brand: 'Stride',
    garment: 'shoe',
    price: 1250,
    material: 'Mesh upper, EVA sole',
    care: care.leather,
    description: 'Light sneakers with easy hook-and-loop straps.',
    specs: { Closure: 'Velcro', Sole: 'EVA' },
    sizes: ['28', '30', '32'],
    colors: [
      { name: 'Blue', hex: '#3d6fd6' },
      { name: 'Red', hex: '#d6453d' },
    ],
  },
  {
    name: 'Kids Sun Cap',
    category: 'children-kids-wear',
    brand: 'Little Elvate',
    garment: 'cap',
    price: 350,
    material: '100% cotton',
    care: care.cotton,
    description: 'Breathable cotton cap to keep little ones shaded.',
    specs: { Size: 'Adjustable' },
    sizes: ['One size'],
    colors: [{ name: 'Green', hex: '#4caf7a' }],
  },
];
