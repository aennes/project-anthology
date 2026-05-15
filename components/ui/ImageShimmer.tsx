import React from 'react';

interface ImageShimmerProps {
  aspectRatio?: string;
  className?: string;
}

/** Static placeholder while images load (no CSS animation). */
const ImageShimmer: React.FC<ImageShimmerProps> = ({
  aspectRatio = '16/9',
  className = '',
}) => {
  return (
    <div
      className={`relative overflow-hidden bg-f1-dark ${className}`}
      style={{ aspectRatio }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-f1-black via-f1-dark to-f1-carbon" />
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />
      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-f1-red/20 to-transparent" />
    </div>
  );
};

export default ImageShimmer;
