export interface Shop {
  id: string;
  artistId: string;
  name: string;
  website: string;
  imageGallery: string[];
  shopFeed: string;
}

export interface Variant {
  id: string;
  title: string;
  link: string;
  price: number;
  image: string;
}

export interface Product {
  groupId: string;
  title: string;
  productType: string;
  variants: Variant[];
}
