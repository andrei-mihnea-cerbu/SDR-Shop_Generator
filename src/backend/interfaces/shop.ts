export interface Shop {
  id: string;
  artistId: string;
  name: string;
  website: string;
  imageGallery: string[];
  shopFeed: string;
}

export interface ShopRow {
  id: string;
  artistId: string;
  name: string;
  website: string;
  hasImage: number;
  shopFeed: string;
}

export interface ShopEntity {
  id: string;
  artistId: string;
  name: string;
  website: string;
  hasImage: boolean;
  shopFeed: string;
}

export interface ShopApiDto {
  id: string;
  name: string;
  website: string;
  imageDataUri?: string;
  artistId: string;
  shopFeed: string;
}
