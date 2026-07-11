/** Sample catalog for barber-classic preview & docs (URLs must match seed.sql master_defaults) */

export interface BarberCatalogItem {
  name: string;
  price: string;
  description?: string;
  image?: string;
}

export const BARBER_SAMPLE_IMAGES = {
  pomade: 'https://jivyvnhqoegiiyodmdnc.supabase.co/storage/v1/object/public/assets/organizations/bagdja-dev/Product%20Sample/1783313473500-b9465e70-pomade',
  beardOil: 'https://jivyvnhqoegiiyodmdnc.supabase.co/storage/v1/object/public/assets/organizations/bagdja-dev/Product%20Sample/1783313425069-afac0c08-berdoil',
  haircut: 'https://jivyvnhqoegiiyodmdnc.supabase.co/storage/v1/object/public/assets/organizations/bagdja-dev/Product%20Sample/1783313503792-87e70f14-haircut',
  shave: 'https://jivyvnhqoegiiyodmdnc.supabase.co/storage/v1/object/public/assets/organizations/bagdja-dev/Product%20Sample/1783313490216-dc69c67e-shave',
  hairWash: 'https://jivyvnhqoegiiyodmdnc.supabase.co/storage/v1/object/public/assets/organizations/bagdja-dev/Product%20Sample/1783313456720-66550be3-hairwash',
  barberShop: 'https://jivyvnhqoegiiyodmdnc.supabase.co/storage/v1/object/public/assets/organizations/bagdja-dev/Product%20Sample/1783313444388-0d6a084e-barbershop',
} as const;

export const BARBER_SAMPLE_SERVICES: BarberCatalogItem[] = [
  {
    name: 'Potong Rambut',
    price: 'Rp 50.000',
    description: 'Konsultasi style + potong presisi.',
    image: BARBER_SAMPLE_IMAGES.haircut,
  },
  {
    name: 'Cukur Jenggot',
    price: 'Rp 35.000',
    description: 'Trim dan shaping jenggot profesional.',
    image: BARBER_SAMPLE_IMAGES.shave,
  },
  {
    name: 'Paket Komplit',
    price: 'Rp 100.000',
    description: 'Potong + cukur + hair wash + styling.',
    image: BARBER_SAMPLE_IMAGES.barberShop,
  },
];

export const BARBER_SAMPLE_PRODUCTS: BarberCatalogItem[] = [
  {
    name: 'Pomade Premium',
    price: 'Rp 85.000',
    description: 'Hold kuat, water-based, aroma maskulin.',
    image: BARBER_SAMPLE_IMAGES.pomade,
  },
  {
    name: 'Beard Oil',
    price: 'Rp 65.000',
    description: 'Minyak jenggot organik, jenggot lembut & sehat.',
    image: BARBER_SAMPLE_IMAGES.beardOil,
  },
];
