Read-only findings: guest-journey video (nothing changed)

1. The Opportunity
- It comes from the Optional Library template "Review your property's guest journey" (id 6256028b-d625-4f74-8753-a414e72e018d).
- No video is stored anywhere: the helpful-link URL is empty, no video field is set, and no file is attached. Library items have no video field at all.
- Dana is Dana Syska (Niles/Buckland program). She has not started this Opportunity, so she only sees the library card.
- Only one real home has started it: the Linders' 1399 Foxtail (item 57d4f162…, open). Its copy has no link either.
- What reads as a video is the cover photo (an entryway with a suitcase). There is nothing to play.

2. Why it won't play
- There is no video link in the system, so there was nothing to check with curl.
- Even with a link, the homeowner portal does not play videos. It shows a "Helpful link" that opens in a new tab. Uploaded files open through a short-lived private link in a new tab, and the browser plays the MP4 there.

3. Can Resolve host it today
- File storage is private and accepts files up to 250 MB, so the 129 MB file fits.
- But the Optional Library editor only has "Helpful link URL". There is no upload option.
- Per-home Task files exist, but that means one upload per home and they don't carry over to library items.
- Hosting it in Resolve for every owner would take a code change.

4. Recommended fix: option (b), no code change
- Upload the video to YouTube as Unlisted, or to Vimeo as "Anyone with the link".
- In Resolve, open Active Owner → Optional Library → "Review your property's guest journey" → Edit.
- Paste the link into "Helpful link URL", set the label to "Watch: Understanding your property's guest journey", and save.
- Owners tap it and it plays in the YouTube or Vimeo player, on phones too.
- Option (c), a SharePoint/OneDrive "anyone" link, often asks for a sign-in or forces a download, and some company settings block it. Not reliable.
- Option (a), uploading into Resolve, isn't supported today.

5. Existing Opportunities
- Starting an Opportunity copies the template at that moment. Changing the template only affects Opportunities started afterward.
- Dana hasn't started hers, so she will see the link.
- The Linders' started copy will not update. Adding the link there needs a separate, approved per-home change.

Not verified
- Dana's live screen.
- That her portal shows only Niles/Buckland homes.
- That the Library editor accepts YouTube links on save.
