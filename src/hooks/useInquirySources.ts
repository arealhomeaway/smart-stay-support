import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { InquirySource } from "@/lib/inquiry-sources";
import { INQUIRY_SOURCE_COLUMNS, mapInquirySource } from "@/lib/inquiry-sources.data";

/** Every booking source a coordinator can quote against, newest edits included. */
export function useInquirySources() {
  return useQuery({
    queryKey: ["inquiry-sources"],
    queryFn: async (): Promise<InquirySource[]> => {
      const { data, error } = await supabase.from("inquiry_sources").select(INQUIRY_SOURCE_COLUMNS).order("name");
      if (error) throw error;
      return (data ?? []).map((row) => mapInquirySource(row as Record<string, unknown>));
    },
  });
}
