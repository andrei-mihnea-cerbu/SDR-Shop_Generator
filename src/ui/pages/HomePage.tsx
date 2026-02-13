import React, { useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
} from '@mui/material';
import axios from 'axios';
import Banner from '../components/Banner';
import { Product, Shop } from '../interfaces/shop';

const HomePage: React.FC = () => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1️⃣ Get shop info
        const response = await axios.get<Shop>('/info');
        console.log('Shop info:', response.data);
        setShop(response.data);

        // 2️⃣ Fetch XML feed
        const feedRes = await axios.get<string>(response.data.shopFeed, {
          responseType: 'text',
        });
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(feedRes.data, 'application/xml');

        // 3️⃣ Extract items
        const items = Array.from(xmlDoc.getElementsByTagName('item'));
        const grouped: Record<string, Product> = {};

        items.forEach((item) => {
          const id = item.getElementsByTagName('g:id')[0]?.textContent || '';
          const title =
            item.getElementsByTagName('g:title')[0]?.textContent || '';
          const link =
            item.getElementsByTagName('g:link')[0]?.textContent || '';
          const priceStr =
            item.getElementsByTagName('g:price')[0]?.textContent || '0';
          const price = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
          const image =
            item.getElementsByTagName('g:additional_image_link')[0]
              ?.textContent || '';
          const groupId =
            item.getElementsByTagName('g:item_group_id')[0]?.textContent || id;
          const productType =
            item.getElementsByTagName('g:product_type')[0]?.textContent ||
            'Other';

          if (!grouped[groupId]) {
            grouped[groupId] = {
              groupId,
              title,
              productType,
              variants: [],
            };
          }

          grouped[groupId].variants.push({
            id,
            title,
            link,
            price,
            image,
          });
        });

        // Convert grouped products to a flat array
        setProducts(Object.values(grouped));
      } catch (err) {
        console.error('Error fetching feed:', err);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  return (
    <Box>
      {/* 🎸 Banner */}
      {shop && (
        <Banner
          imageUrl={
            shop && shop.hasImage ? `${API_URL}/shops/${shop.id}/photo` : ''
          }
          mainTitle={`${shop.name} Shop`}
          subTitle="Find exclusive artist merchandise and support your favorite music!"
        />
      )}

      {/* 🛍️ Products Section */}
      <Box textAlign="center" mt={4} mb={3}>
        <Typography variant="h4" fontWeight="bold" color="primary">
          Products
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mt: 0.5 }}>
          Explore our exclusive collection from{' '}
          {shop?.name || 'your favorite artist'}
        </Typography>
      </Box>

      {/* ⏳ Loading Spinner */}
      {loading && (
        <Box display="flex" justifyContent="center" mt={6}>
          <CircularProgress size={50} />
        </Box>
      )}

      {/* 🛒 Product Grid */}
      {/* 🛒 Product Grid */}
      {!loading && (
        <Box
          display="grid"
          gridTemplateColumns="repeat(auto-fill, minmax(260px, 1fr))"
          gap={3}
          px={4}
          pb={6}
          justifyContent="center"
        >
          {products.map((p) => {
            const minPrice = Math.min(...p.variants.map((v) => v.price));
            const maxPrice = Math.max(...p.variants.map((v) => v.price));
            const displayPrice =
              minPrice === maxPrice
                ? `$${minPrice.toFixed(2)}`
                : `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;

            const coverImage = p.variants[0]?.image || '/placeholder.jpg';
            const link = p.variants[0]?.link || '#';

            return (
              <Card
                key={p.groupId}
                sx={{
                  borderRadius: 3,
                  boxShadow: 4,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    boxShadow: 8,
                  },
                }}
              >
                <CardActionArea
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                  }}
                >
                  <CardMedia
                    component="img"
                    height="300"
                    image={coverImage}
                    alt={p.title}
                    sx={{
                      objectFit: 'cover',
                      width: '100%',
                      transition: 'transform 0.3s ease',
                      '&:hover': { transform: 'scale(1.05)' },
                    }}
                  />
                  <CardContent
                    sx={{
                      textAlign: 'center',
                      flexGrow: 1,
                      p: 2,
                      bgcolor: '#fafafa',
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      fontWeight="bold"
                      gutterBottom
                      noWrap
                      title={p.title}
                    >
                      {p.title}
                    </Typography>
                    <Typography
                      color="primary"
                      variant="body1"
                      fontWeight={600}
                    >
                      {displayPrice}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default HomePage;
