import Image from 'next/image';

export function Logo(): JSX.Element {
  return <Image src="/logo.png" alt="Jumentix logo" width={32} height={32} />;
}
