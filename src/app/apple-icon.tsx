import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
  const logoData = await fetch(new URL('../../public/logo.png', import.meta.url)).then(
    (res) => res.arrayBuffer()
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'white',
        }}
      >
        {/* @ts-expect-error Satori allows passing ArrayBuffer directly to src */}
        <img src={logoData} alt="Zinergia Logo" width="80%" style={{ objectFit: 'contain' }} />
      </div>
    ),
    { ...size }
  );
}
