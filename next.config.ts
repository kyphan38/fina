import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Huy hiệu dev của Next nằm đè lên tab Log ở góc trái đáy - tắt đi để test
  // trên điện thoại cho đúng vị trí chạm thật.
  devIndicators: false,
};

export default nextConfig;
