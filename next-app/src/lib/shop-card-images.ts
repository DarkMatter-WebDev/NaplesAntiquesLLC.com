import {
  normalizeProductImagePaddingValue,
  productImagePaddingForImage,
  type Product,
  type ProductImagePaddingMap,
} from '@/types/product';

export function getMountedProductImageIndexes(
  imageCount: number,
  activeIndex: number,
  carouselEngaged: boolean,
): number[] {
  if (imageCount <= 0) return [];
  if (!carouselEngaged) return [0];

  const safeActiveIndex = Math.min(Math.max(0, Math.trunc(activeIndex)), imageCount - 1);
  return [safeActiveIndex - 1, safeActiveIndex, safeActiveIndex + 1]
    .filter((index) => index >= 0 && index < imageCount);
}

export function compactShopCardProductImages(product: Product): Product {
  const usesImageUrls = product.image_urls.length > 0;
  const selectedImages = usesImageUrls ? product.image_urls : product.images;
  const fallbackPadding = normalizeProductImagePaddingValue(product.image_padding);
  const compactPadding = selectedImages.reduce<ProductImagePaddingMap>((result, image, index) => {
    const padding = productImagePaddingForImage(
      product.image_padding,
      product.image_padding_by_image,
      image,
      index,
    );
    if (padding !== fallbackPadding) result[String(index)] = padding;
    return result;
  }, {});

  return {
    ...product,
    images: usesImageUrls ? [] : product.images,
    image_urls: usesImageUrls ? product.image_urls : [],
    image_padding_by_image: Object.keys(compactPadding).length > 0 ? compactPadding : null,
  };
}
