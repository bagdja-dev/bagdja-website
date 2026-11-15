import { TenantPageLoading } from '../../components/tenant-page-loading';

/**
 * Ditampilkan langsung saat berpindah halaman tenant sambil data halaman berikutnya dimuat server.
 * Dengan shell template (D8) indikator ini berada di dalam outlet — header, footer, dan navigasi bawah tetap.
 */
export default function TenantLoading() {
  return <TenantPageLoading />;
}
