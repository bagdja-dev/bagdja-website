/** Sample catalog untuk preview & dokumentasi template store-classic (data fiktif, bukan tenant sungguhan) */

export interface StoreCatalogItem {
  name: string;
  price: string;
  description?: string;
  image?: string;
  category?: string;
}

function placeholder(seed: string, w = 600, h = 600) {
  return `https://placehold.co/${w}x${h}/1e293b/f8fafc?text=${encodeURIComponent(seed)}`;
}

export const STORE_SAMPLE_IMAGES = {
  kaosOversize: placeholder('Kaos+Oversize'),
  kemejaFlanel: placeholder('Kemeja+Flanel'),
  jeansSlimFit: placeholder('Jeans+Slim+Fit'),
  chinoRegular: placeholder('Chino+Regular'),
  jaketDenim: placeholder('Jaket+Denim'),
  hoodieFleece: placeholder('Hoodie+Fleece'),
  dressMidi: placeholder('Dress+Midi'),
  rokPlisket: placeholder('Rok+Plisket'),
} as const;

export const STORE_SAMPLE_PRODUCTS: StoreCatalogItem[] = [
  {
    name: 'Kaos Oversize Katun',
    price: 'Rp 99.000',
    description: 'Bahan katun combed 24s, potongan oversize kekinian.',
    image: STORE_SAMPLE_IMAGES.kaosOversize,
    category: 'Atasan',
  },
  {
    name: 'Kemeja Flanel Kotak',
    price: 'Rp 159.000',
    description: 'Motif kotak klasik, cocok untuk gaya casual maupun semi-formal.',
    image: STORE_SAMPLE_IMAGES.kemejaFlanel,
    category: 'Atasan',
  },
  {
    name: 'Hoodie Fleece Basic',
    price: 'Rp 175.000',
    description: 'Fleece tebal, hangat, tersedia beberapa pilihan warna polos.',
    image: STORE_SAMPLE_IMAGES.hoodieFleece,
    category: 'Atasan',
  },
  {
    name: 'Celana Jeans Slim Fit',
    price: 'Rp 219.000',
    description: 'Denim stretch, nyaman dipakai sepanjang hari.',
    image: STORE_SAMPLE_IMAGES.jeansSlimFit,
    category: 'Bawahan',
  },
  {
    name: 'Celana Chino Regular',
    price: 'Rp 189.000',
    description: 'Bahan chino ringan, tersedia beberapa pilihan warna.',
    image: STORE_SAMPLE_IMAGES.chinoRegular,
    category: 'Bawahan',
  },
  {
    name: 'Rok Plisket A-Line',
    price: 'Rp 149.000',
    description: 'Rok plisket ringan, cocok dipadukan dengan atasan apa saja.',
    image: STORE_SAMPLE_IMAGES.rokPlisket,
    category: 'Bawahan',
  },
  {
    name: 'Jaket Denim Unisex',
    price: 'Rp 259.000',
    description: 'Jaket denim tebal, unisex, cocok untuk segala musim.',
    image: STORE_SAMPLE_IMAGES.jaketDenim,
    category: 'Outerwear',
  },
  {
    name: 'Dress Casual Midi',
    price: 'Rp 229.000',
    description: 'Dress midi bahan rayon adem, cocok untuk jalan-jalan maupun kerja.',
    image: STORE_SAMPLE_IMAGES.dressMidi,
    category: 'Dress',
  },
];
