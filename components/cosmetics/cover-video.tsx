"use client";

type VideoConfig = {
  videoPath?: string;
};

type Props = {
  config: VideoConfig;
};

export function CoverVideo({ config }: Props) {
  const path = config?.videoPath;
  if (!path) return null;

  return (
    <video
      autoPlay
      muted
      loop
      playsInline
      className="absolute inset-0 w-full h-full object-cover"
    >
      <source src={path} type="video/mp4" />
    </video>
  );
}
