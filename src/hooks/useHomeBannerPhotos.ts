import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatPropertyLabel } from "@/lib/property-label";
import { homePhotoUrl } from "@/components/property/HomePhoto";
import { applyTestDataFilter } from "@/lib/test-data";
import type { BannerHome } from "@/lib/daily-home-photo";

/** The one pool of real ARHA home photos the Operations Home and Onboarding Home banners pick from daily. */
export function useHomeBannerPhotos() {
  return useQuery({
    queryKey: ["home-banner-photos"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<BannerHome[]> => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, is_demo, address_line1, unit, city, state, postal_code, primary_photo_medium_url, primary_photo_url")
        .not("primary_photo_url", "is", null);
      if (error) throw error;
      return applyTestDataFilter(data ?? [], false, (p) => p).map((p) => ({
        id: p.id,
        photo: homePhotoUrl(p) ?? "",
        name: formatPropertyLabel(p).primary,
        city: p.city,
      }));
    },
  });
}
