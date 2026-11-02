-- Exact undo for wording v1: restores every old value from receipt.csv, guarded on the new value.
BEGIN;
UPDATE public.onboarding_template_tasks SET title = $w$Send the introduction email and schedule the Owner Investment Readiness Call$w$ WHERE id = '08e85522-4f53-4236-833d-05da550b2f8f' AND md5(title::text) = 'e60bec2c4dc9b93c528948b7c1b055e5';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
DFY lets us know a home is under contract. This is the owner's first message from us. It congratulates them and sets up the Owner Investment Readiness Call with Emily, our COO, where every owner (Active Owner or standard) learns how onboarding works and how they will be involved. We no longer send a welcome guide PDF; the call replaces it.

Instructions:
1. Reply to DFY's introduction email using the draft below. Thank the person who introduced you, and adjust it so it sounds like you and fits this owner.
2. Ask for a few days and times over the next week, including their time zone.
3. When they reply, ask Emily to host the call at one of their times, then send the invite (next step).

Subject: Welcome to A Real Home Away! Let's Get Your Readiness Call Scheduled
Hi {owner first names},
It's so nice to meet you, and congratulations on going under contract on {property address}! We're excited to partner with you on this home.
I'm {your first name}, {your title} at A Real Home Away, and I'll be guiding you through the process of getting your home set up, furnished, and guest ready. Thank you, {DFY contact}, for the introduction!
The first step is an Owner Investment Readiness call with Emily Jimenez, our COO. On this call, Emily will walk you through how we work together, what to expect from onboarding, and how you'll be involved along the way. With your closing date set for {closing date}, we want to get started as soon as possible so you're set up for success from day one.
Could you share a few days and times that work for you over the next week? Please include your time zone, and we'll get something on the calendar.
Looking forward to working with you!
Warmly,
{your name}
{your title}
A Real Home Away

Done when:
The email is sent and the owner has been asked for availability.

If it stalls:
No reply in 2 business days: send a short follow-up asking for times, and let DFY know if you still can't reach them.$w$ WHERE id = '08e85522-4f53-4236-833d-05da550b2f8f' AND md5(detail::text) = 'edf7f39fe486dcaf5926203559a6d77c';
UPDATE public.onboarding_template_tasks SET title = $w$Send the Owner Investment Readiness Call invite$w$ WHERE id = '8e7ce79a-2a0d-4f26-a9fa-ef1398f6ffc0' AND md5(title::text) = 'eaf0a6b1f365d181503404b272bcfb7e';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Once the owner shares their availability, the invite goes out from Outlook so everyone has the details in one place.

Instructions:
1. Confirm the time with Emily, who hosts the call.
2. Create a Teams meeting titled: Owner Investment Readiness Call | {property name}
3. Required: every owner on the property and Emily Jimenez, COO. Optional: Steve and Mike from DFY.
4. Paste the description below and send.
5. Set the due date on Hold the Owner Investment Readiness Call to the meeting date.

Hi everyone,
We're looking forward to meeting with you! This call is designed to get you ready for everything ahead. We'll walk through our onboarding process from closing to launch, share how and when you'll be involved along the way, and give you a look at how our operations team will care for your home and keep you informed once it's live.
It's also a chance for us to get to know you and your goals for this investment, so please bring any questions you have. Nothing is too small to ask.
See you soon,
The A Real Home Away Onboarding Team

Done when:
The invite is sent and the call date is set on the next call step.$w$ WHERE id = '8e7ce79a-2a0d-4f26-a9fa-ef1398f6ffc0' AND md5(detail::text) = '38db21f52bfb0298865439253a0b3195';
UPDATE public.onboarding_template_tasks SET title = $w$Hold the Owner Investment Readiness Call$w$ WHERE id = 'ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49' AND md5(title::text) = '3be2c98726aa11aaae97c61833697de3';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Emily leads this call. It prepares every owner for onboarding and introduces how operations works after launch. It starts by getting to know the owner, then follows the presentation. Update this step's due date to the call date. Presentation: https://arealhomeaway.sharepoint.com/:p:/s/CrossTeamAlignment/IQDpdRv0soxTTKN23J58cclWAfW1AhrASO_WRSa7VTeIq88

Instructions:
1. Before the call: check whether this is an Active Owner or standard owner. Active Owners take part through opportunities in the owner portal. Standard owners review and approve key items by email.
2. Fill in this home's dates and team in the presentation.
3. Active Owner: make sure they are set up in Resolve so the call hours count, and release the opportunity on this step after the call.

Agenda:
1. Introductions from everyone at ARHA on the call.
2. Get to know the owner: where they're from, how familiar they are with short or mid-term rentals, whether this is their first investment property, and what they hope this home does for them.
3. The presentation, from closing to launch.
4. Their involvement: what we need from them and when, for their owner type.
5. Life after launch: how operations cares for the home and keeps them informed.
6. Questions, then a recap of next steps.

After the call, add your notes to this step, including anything the owner asked for more information on.

Done when:
The call is complete and notes are saved on this step.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 1 hour. Release: as soon as the call is held.$w$ WHERE id = 'ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49' AND md5(detail::text) = 'e2c2ba55d585e3674705131cadc92d28';
UPDATE public.onboarding_template_tasks SET opportunity = $w${"how": "Enter the length of your call in the time field and add a few notes on what stood out to you, such as goals you shared, questions answered, or next steps.", "why": "This call set the foundation for your investment and your partnership with us, and it counts toward your Active Owner participation. Logging it keeps your record complete and gives you a quick reference for what was discussed.", "what": "Record the time you spent in your Owner Investment Readiness Call with our team, along with any key takeaways from the conversation.", "title": "Log your Owner Investment Readiness Call"}$w$::jsonb WHERE id = 'ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49' AND md5(opportunity::text) = '0fddcca8ca940293a3ae2b97244c4a0d';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Full furnishing homes only. The onboarding budget is what the designer designs to, so it goes out early enough for them to review the home and plan with time to spare. The starting numbers come from the DFY estimate the owner already saw: the furnishing package and the make ready updates.

Instructions:
1. Open the DFY estimate for this home and find the furnishing package (base package for the bedroom count, plus any added rooms like a bonus room or extended patio) and the make ready updates.
2. Create the home's onboarding budget in the Notion Onboarding Budget tracker. Guide: https://www.notion.so/arealhomeaway/Using-the-Onboarding-Budget-Tracker-1b24658d5f4f80008dcbfdd2bbb30de7
3. Enter the furnishing package total and each added room as its own line.
4. Note which rooms get TVs: a 65 inch in the living room, a 55 inch in the primary bedroom, and a 55 inch in any bonus room that gets one.
5. Note the furniture vendor for the market: Urban Styles for Indy homes, Living Spaces for Oklahoma and Texas homes.
6. Enter the DFY furnishing estimate and DFY make ready estimate on the project page. The make ready number is the baseline the Make Ready Estimate is checked against.
7. Tag the Lead Designer and designer in Telegram with the budget link.

Done when:
The onboarding budget exists in Notion, the DFY numbers are on the project page, and the design team has the link.

Good to know:
Goal: an estimated margin of 16% or higher on the furnishing package.$w$ WHERE id = '027c0af0-277e-4e4c-a682-0f48eef4b7b0' AND md5(detail::text) = '318f96bb8e4d19663c296079cb4745d0';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Full furnishing homes only. The listing photos are the designer's first look at the home, before the assessment. Reviewing them early surfaces questions while there is still time to ask during the inspection.

Instructions:
1. Open the Zillow link on the project page.
2. Screenshot each listing photo and save the images to the property's MLS Photos folder in OneDrive.
3. Note anything that affects furnishing or updates: finishes, paint colors, window types, fireplace, built ins, outdoor spaces.
4. Post any questions for the inspection walkthrough in Telegram and tag the PM.

Done when:
MLS photos are in OneDrive and any questions are with the PM.

Where it goes:
OneDrive / MLS Photos.$w$ WHERE id = 'e5e41d29-dcaa-45f8-9e15-9a6199a0ed6e' AND md5(detail::text) = '3a57b133461b7a7488a40bf8d5b99c46';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
A full walkthrough video and photos of every room let the designer, PM, and owner see the home without another visit. Active Owners also get the video as an opportunity as soon as it is filmed.

Instructions:
1. Message the handyman in the property Telegram group to confirm they can attend at the inspection date and time.
2. Click Dispatch to Breezeway. The New House Setup - Walkthrough Video & Photos template loads with this property attached.
3. Assign the handyman and schedule it for the inspection date and time. Add the access details to the task notes.
4. Ask the handyman to post short videos in Telegram while they walk through, so you and the designer can ask questions in real time.
5. When Breezeway marks it complete, QC the results: everything requested is there, readable, and labeled. Then complete this step.
6. Active Owner: attach the video to the opportunity on this step so it releases.

Done when:
The Breezeway task is complete and the video and photos are uploaded.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 0.5 hours. Release: as soon as the walkthrough video is filmed.

Where it goes:
OneDrive / New House Setup Documents. Post the link in Telegram for the designer.$w$ WHERE id = '9c26d406-c71f-4802-b14f-36dfe5164839' AND md5(detail::text) = 'fe1644f44b5de6dec9726ce1355b6a5f';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Before we price the Make Ready Estimate, we need to know what the city and HOA require for a short-term rental. This depends on Kade's CC&R review from Intake.

Instructions:
1. Open the CC&R review page in Notion and confirm Kade's review is complete and notes are added.
2. Check the STR research on the Notion Active Projects page: permit required (yes or no) and cost.
3. Check whether an STR application, registration, or approval process limits the home to 30-day minimum stays until approved. If so, tell the Director of Onboarding the same day so the owner can be told right away.
4. Post the result to the PM on this task using the template below.

Permit required:
STR permit research is complete and a permit is required. The cost is ${amount}. Please add the permit cost plus a $100 processing cost to the Make Ready Estimate. The $100 needs to be its own line item.

No permit required:
STR permit research is complete. No STR permit is required for this home, so nothing needs to be added to the Make Ready Estimate.

Either way, add any 30-day minimum to the handoff notes for Operations. If one applies, change the OwnerRez tag from Short-Term Safe to Mid-Term Flexible Strict.
Active Owner with an HOA: once Kade's review is done, attach the HOA documents to the opportunity on this step so it releases. No HOA: skip the opportunity.

Done when:
The PM has the permit result and cost, and any 30-day minimum is recorded.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 1 hours. Release: after Kade has reviewed the covenants.

Where it goes:
Notion Active Projects page (STR research view) and this task.

If it stalls:
Kade's review is not done 3 business days after the HOA documents were sent: follow up with Kade. If the HOA does not allow short-term rentals, tell the Director of Onboarding the same day.$w$ WHERE id = '5d5be939-b373-4693-bf33-926f8f7658c4' AND md5(detail::text) = '6f38855e07f9e3292d6af74b6655be09';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
ARHA is not part of the inspection or the repair negotiation between buyer and seller. We keep copies of what came out of it, and we give the owner a chance to tell us which items they would like us to look at during onboarding.

Instructions:
1. Ask the realtor for the inspection report and any document that came with it showing what the seller agreed to fix. The name of that document changes by state (for example, the TRR in Oklahoma), so ask for it by what it does, not by name.
2. Save both to OneDrive and upload copies to this task.
3. Standard owner: send the email below. Active Owner: attach the report to the opportunity on this step so it releases. If repair estimates are already scheduled, add a line asking them to flag items before that date.
4. Add any items the owner asks about to your repair estimate request.

Subject: Your inspection report for {property address}
Hi {owner first name},
We received a copy of the inspection report for {property address} and saved it with your home's records, along with what the seller agreed to repair.
Are there any items from the report you'd like us to take a look at during onboarding? If so, just reply with what they are and we'll include them when we gather repair estimates.
Kindly,
{PM name}

Done when:
The report and any seller repair document are saved, and the owner has been asked about repairs.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback, Upload / Documentation. Suggested time 1.5 hours. Release: when the inspection report is received.

Where it goes:
OneDrive / Contract and Closing Documents.

If it stalls:
The realtor does not have the report yet: it usually comes 1 to 2 days after the inspection. Follow up then.$w$ WHERE id = '279f478e-a393-43b4-b691-90cdadaa3f5d' AND md5(detail::text) = 'dbb50b5d98c500798369f1dc6e08df8b';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Landscaping

About this step:
New homes should head into management needing only routine lawn care. The landscaper walks the exterior and recommends what it takes to get there, so it can be priced into the Make Ready Estimate.

Instructions:
1. Message the landscaper for this market and ask for recommendations and a quote for a new property coming onboard: pulling weeds, adding or replacing plants, mulch, and a full lawn cleanup.
2. Share the address and exterior photos from the walkthrough. The exterior can usually be viewed before closing.
3. Ask for the quote broken out by item within 2 to 3 business days.
4. Add the approved items to the Make Ready Estimate.

Done when:
The landscaper's recommendations and quote are on this task.

Where it goes:
OneDrive / New House Setup Documents.$w$ WHERE id = 'e1cf0100-6af7-4240-adf2-672f799d2553' AND md5(detail::text) = 'd4588ae811ca118cfcbece98f5770e5d';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Full furnishing homes only. Everything the designer needs lives on the project page. This step is a check that it is all there once the assessment is done, not a list of things to send.

Instructions:
1. Check the project page has: the Zillow link (added at Intake), the Houzz Pro floor plans, the walkthrough video, and the onboarding budget link.
2. Fill in anything missing, or tag the person who owns it.
3. Confirm the Lead Designer and designer are assigned.
4. Share owner preferences from the Owner Investment Readiness Call and the warm transfer in the Telegram group, and tag the designer.

Done when:
Every design input is on the project page and the designer has been tagged.$w$ WHERE id = '7c6b189e-e4c7-4ef4-b26a-5c5e2ae623aa' AND md5(detail::text) = 'a3d6d654298010f7c8734f311b3abb19';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Full furnishing homes only. Measured floor plans and the walkthrough are what the designer plans every room from, including curtains and TV placement.

Instructions:
1. Open the property's project in Houzz Pro and find the floor plans under the 3D Floor Plan tab in Planning.
2. Watch the walkthrough video and read the New House Assessment results.
3. Note window measurements for the window treatment pick list and room sizes for the floor plans.
4. Ask the PM in Telegram about anything unclear.

Done when:
You have what you need to start the floor plans and mood boards.

Good to know:
Designers do not have LastPass seats, so the Onboarding Manager shares logins directly. Houzz Pro sends a verification code to our Grasshopper line, so message the PM or Onboarding Manager in Telegram when you log in and they will send you the code.$w$ WHERE id = '387e2082-354b-4314-ab22-42a24cb14654' AND md5(detail::text) = 'd0a1f395c1e834201a16eee5bce506e7';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Utilities Option 1 or 2

About this step:
Guests expect fast, reliable Wi-Fi the first night. Install dates book out, so schedule early. Option 3 homes: mark this step not needed.

Instructions:
1. Find the internet provider for the address (Cox or Xfinity, depending on market).
2. Order internet only, about 500 Mbps. Ask about specials and ask to waive the install fee.
3. Set up the account under ARHA's account holder per the utilities guide in LastPass, with the authorized users listed there. Give the account holder a heads up before calling so they can verify.
4. Schedule the technician install as soon as possible after closing, ideally the day after.
5. Turn on autopay.
6. Log the account in the Utility Setup form: https://arha.fillout.com/utilitysetup. Save logins and PINs in LastPass only.

Done when:
Internet is ordered, the install is scheduled, autopay is on, and the Utility Setup form is submitted.

Where it goes:
Utility Setup form (Notion). Never put logins, PINs, or passwords on this task. Use LastPass.

If it stalls:
Provider needs owner authorization: send the signed LOA from OneDrive. Still stuck: tell the Onboarding Manager.$w$ WHERE id = 'bca10155-f463-454b-8bbd-e69b36bbf8d8' AND md5(detail::text) = '8b608f457a904f7d93032513fc35a001';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Utilities Option 1 or 2

About this step:
A handyman meets the technician so the modem goes somewhere discreet. Option 3 homes: mark this step not needed.

Instructions:
1. Create the work order in Breezeway from the New House Setup - Meet Cox Installer template.
2. Add the PM's email on the first line.
3. Set the date to the install appointment and leave it unassigned until after closing.
4. The template asks for the modem in, in order: a hall, entry, or primary closet; a secondary bedroom dresser; the living room mantle. It also asks the handyman to tell the PM if a line is run outside and not buried.

Done when:
The installer work order is drafted for the install date.

Where it goes:
Utility Setup form (Notion). Never put logins, PINs, or passwords on this task. Use LastPass.

If it stalls:
Provider needs owner authorization: send the signed LOA from OneDrive. Still stuck: tell the Onboarding Manager.$w$ WHERE id = '24c89ace-256f-4b47-b9cc-b856e15bf204' AND md5(detail::text) = 'f3e6244a81f41f4b91c5d8f6b42c5c9f';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
The owner approves repairs before we schedule them. Standard owners receive it now. Active Owners receive it as an opportunity at Access Confirmed, so prepare it now and it releases on its own.

Instructions:
1. Standard owner: send the estimate through Houzz Pro (CC yourself), then send the email below.
2. Active Owner: check the opportunity fields on this step are filled in and the estimate link is attached. If the estimate has optional items, change the time to 1.5 hours and ask them to note which to include.
3. Record the date sent on this task.

Subject: {property address} Make Ready Estimate
Hi {owner first name}!
Attached you'll find the make ready estimate we've put together for {property address}. It covers the repairs, updates, and standard items needed to get your home guest ready.
{A sentence or two on anything notable: what it is and why it matters for guests. If the total is more than $500 over the DFY estimate, explain what was added here.}
Once you close, we'll invoice 50% of the make ready estimate along with 50% of your furnishing package. The remaining make ready balance is invoiced after final costs are confirmed.
Once you've had a chance to review, just let me know if you approve or have any questions, and we'll get everything scheduled so work can start right after closing.
Thank you!
{PM name}

Done when:
Standard owner: estimate and email sent and the date recorded. Active Owner: opportunity ready to release.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Business Decision. Suggested time 1 hours. Release: at Access Confirmed.

If it stalls:
Owner wants to talk it through: offer a quick call and invite the Director of Onboarding if costs are being questioned.$w$ WHERE id = '3621f91b-80aa-4e90-b92f-f978c7fb6743' AND md5(detail::text) = '7b6f32356f0843a4bf6964fd848bc88c';
UPDATE public.onboarding_template_tasks SET opportunity = $w${"how": "Open the estimate using the link below and review each item. If you have questions or would like to adjust the scope, reach out before signing so we can talk it through. Once you're comfortable with the estimate, sign directly through the link to approve. Please complete your review by [date] so we can lock in vendor schedules.", "why": "This estimate determines what gets done to your home and what it will cost before launch. Reviewing it closely helps you understand where your investment is going and make informed decisions about your property. Your signed approval is what allows us to book vendors and keep your onboarding timeline on track.", "what": "Review the make-ready estimate for your home, which outlines the repairs, updates, and preparation work needed before your property is guest ready. Look over each line item, the scope of work, and the total cost. If everything looks right, sign to approve so we can schedule the work.", "title": "Review and approve your make-ready estimate"}$w$::jsonb WHERE id = '3621f91b-80aa-4e90-b92f-f978c7fb6743' AND md5(opportunity::text) = '532c0be50ae408786e2026f14afab428';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Full furnishing homes only. These become the owner's mood boards and the source for every pick list.

Instructions:
1. Design every space in the budget and the walkthrough video, following the ARHA design standards below.
2. Build floor plans that show accurate furniture sizing for each room.
3. Price everything in the Notion onboarding budget as you go and keep the estimated margin at 16% or higher.
4. Order from the right vendor for the market: Urban Styles for Indy (Robert checks availability and pricing by email, contact in the budget comments) and Living Spaces for Oklahoma and Texas.

ARHA design standards:
Occupancy: plan seating and sleeping for up to 8 guests in a 4 bedroom and up to 6 guests in a 3 bedroom.
Boards: one for every space in the budget and in the walkthrough video, including the entryway, hallways, living room, dining room, kitchen, and every bedroom.
Seating: every main living area and the dining space seats the full occupancy. The kitchen has enough barstools to fill the countertop well.
Bedrooms: a king bed in the primary and queen beds in guest rooms, box springs where needed. Every bed has at least 2 accent pillows and 1 throw blanket. Every bedroom has at least 2 pieces of wall decor (art or a mirror). Add a full length mirror in at least 1 room when budget and space allow.
Study: a desk, desk chair, lamp, and accent chair. Skip bookcases and small decor, which get lost or go unused in a short-term rental.
Materials: wood or metal for barstools, bed frames, and large pieces whenever possible.
Living room furniture: gray or another color that hides stains and wear from guests.

Done when:
Every space has a floor plan and mood board that meets the standards, and the budget is complete.

Where it goes:
Design files, priced in the Notion onboarding budget.$w$ WHERE id = '312e80da-8d3a-4930-84b9-092b4af0d18a' AND md5(detail::text) = '47d5489ec689924c0d16aef4c588c745';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Full furnishing homes only. The PM orders curtains and the handyman installs rods from these, so measurements need to be exact.

Instructions:
1. Follow the guide: https://www.notion.so/arealhomeaway/Creating-the-Window-Treatment-Pick-List-1c44658d5f4f80938d93ed9876b8b4bc
2. Start from the template in OneDrive / New House Setup Documents / Window Covering Details / Window Treatment Pick List.
3. List every window, the curtain length (96 or 108 inch), and the rod for each.
4. Save both as PDFs and tag the PM in Telegram.

Done when:
Both PDFs are saved and the PM has them.

Where it goes:
OneDrive / New House Setup Documents / Window Covering Details.$w$ WHERE id = '5e506db6-8eaa-4ea0-8491-2b4ef174e46b' AND md5(detail::text) = 'b943302c9ea2cc9968af88ba8bbb1b6d';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Utilities Option 1 or 2

About this step:
Electric must be on in the right name on closing day. Option 3 homes: mark this step not needed.

Instructions:
1. Find the provider for the address.
2. Start or transfer service effective the closing date, billed to the owner or ARHA based on the option.
3. Turn on autopay and e-billing.
4. Log it in the Utility Setup form: provider, account number, start date, deposit, and fees.

Done when:
Electric is scheduled for closing, autopay is on, and it's logged.

Where it goes:
Utility Setup form (Notion). Never put logins, PINs, or passwords on this task. Use LastPass.

If it stalls:
Provider needs owner authorization: send the signed LOA from OneDrive. Still stuck: tell the Onboarding Manager.$w$ WHERE id = '16cbd2b8-c5e1-437b-a88a-126fa0092464' AND md5(detail::text) = '5acbe9ba86b4a05cace1ceed9cd1505c';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Utilities Option 1 or 2

About this step:
Only if the home has gas. Option 3 homes: mark this step not needed.

Instructions:
1. Check the New House Assessment. No gas: mark this step not needed.
2. Start or transfer service effective the closing date, billed based on the option.
3. Turn on autopay and e-billing.
4. Log it in the Utility Setup form, including any connection fee.

Done when:
Gas is scheduled and logged, or marked not needed.

Where it goes:
Utility Setup form (Notion). Never put logins, PINs, or passwords on this task. Use LastPass.

If it stalls:
Provider needs owner authorization: send the signed LOA from OneDrive. Still stuck: tell the Onboarding Manager.$w$ WHERE id = '555974cf-be85-4819-b71d-ca8fc2bfde74' AND md5(detail::text) = 'cec1aa9ecde6f007399583158303a093';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Utilities Option 1 or 2

About this step:
Usually billed by the city. Deposits and activation fees often land on the first bill. Option 3 homes: mark this step not needed.

Instructions:
1. Find the city utility for the address.
2. Start or transfer service effective the closing date, billed based on the option.
3. Turn on autopay.
4. Log it in the Utility Setup form, including deposit, activation fee, and when the first bill is expected.

Done when:
Water and sewer are scheduled and logged.

Where it goes:
Utility Setup form (Notion). Never put logins, PINs, or passwords on this task. Use LastPass.

If it stalls:
Provider needs owner authorization: send the signed LOA from OneDrive. Still stuck: tell the Onboarding Manager.$w$ WHERE id = 'dc580210-fbbf-462d-88d9-086668f43856' AND md5(detail::text) = '2e03bc1f4037a6223e0b38360df647e9';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Utilities Option 1 or 2

About this step:
Trash days go to guests and the cleaning team, so details matter as much as the account. Option 3 homes: mark this step not needed.

Instructions:
1. Start or transfer trash service (sometimes billed with water).
2. Turn on autopay.
3. Add the details to the Important Trash Details page in Notion.
4. Add trash info to Breezeway using this format:

Trash is collected on {day}. Recycling is picked up every {day}.
Important Trash Information
1. Non-pickup days: {where bins should be kept, for example the side of the house or the unlocked backyard}.
2. Recycling: {any details}.
3. Holidays: if pickup falls on a holiday, the crew comes the next trash day. {adjust as needed}
4. Please don't store bins in the garage. The crew can't reach them there.
Big trash pickup: {details}.

Log the account in the Utility Setup form.

Done when:
Trash is scheduled, autopay is on, and the details are in Notion and Breezeway.

Where it goes:
Utility Setup form (Notion). Never put logins, PINs, or passwords on this task. Use LastPass.

If it stalls:
Provider needs owner authorization: send the signed LOA from OneDrive. Still stuck: tell the Onboarding Manager.$w$ WHERE id = '35fe9a3c-57db-4e7a-a4e9-04c20db157a6' AND md5(detail::text) = 'a7b3e01cb1fb8014f367ae879a970d3b';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Cameras

About this step:
Created now so the handyman can be booked with one click the moment we have access.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Place surveillance signs / hedge box template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = '7f13b627-0b92-4d63-b050-8ce04f521bb4' AND md5(detail::text) = '2675f5cc383ffca37533ae1105f1a1fb';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Utilities Option 1 or 2

About this step:
The last check so the home has power, water, and Wi-Fi when we walk in. Option 3 homes: mark this step not needed.

Instructions:
1. Check every service is set for the confirmed closing date.
2. Closing dates often move. If the PM reports a new closing date before closing, update every provider the same day.
3. Post a summary in Telegram for the PM: each service, its start date, and the internet install date.
4. If anything is still waiting on the owner or the LOA, tell the Director of Onboarding and recheck the day before closing.

Done when:
Every service is confirmed and the PM has the summary.

Where it goes:
Utility Setup form (Notion). Never put logins, PINs, or passwords on this task. Use LastPass.

If it stalls:
Provider needs owner authorization: send the signed LOA from OneDrive. Still stuck: tell the Onboarding Manager.$w$ WHERE id = 'f9d6fe0a-6199-4f0c-a836-9f9666c7446c' AND md5(detail::text) = 'c28b8ee33e79ad9a36fedffa48f6fb41';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Full furnishing homes only. The design goes through two approvals before anything reaches the owner: the Lead Designer reviews the design, then the Onboarding Manager reviews the budget. The designer's remaining steps open once both approve.

Instructions:
1. Check your boards against the ARHA design standards in the previous step.
2. Upload the mood boards, floor plans, and the Notion onboarding budget link to this step.
3. Tag the Lead Designer in Telegram that the design is ready for review.

Done when:
The Lead Designer has the full design and budget to review.$w$ WHERE id = '4f153a95-fdd6-445f-b411-547a88cb0693' AND md5(detail::text) = '074789bc6474f4c7a6efbece93aa79a4';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Created now so the handyman can be booked with one click the moment we have access. Schedule for the same day as the lock and security installation.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Pre-Work Inspection template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = 'ffe2dea4-0281-48a6-9b30-82882d596248' AND md5(detail::text) = '0d34fef0964d0d4e3403c5f074c85aa6';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Created now so the handyman can be booked with one click the moment we have access. Schedule within 10 calendar days of closing.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Standard Inspection template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = '1755bf2c-2e72-43f7-a27b-64cbb4c16045' AND md5(detail::text) = '2e2ce18c4ffc08ecf361790a9b848c34';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Created now so the handyman can be booked with one click the moment we have access. Schedule once the home is complete, before handoff to Operations.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Final Inspection template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = '20ea3445-8428-486b-9f44-a42405a2dfad' AND md5(detail::text) = '27fe50f845d4d9f8978f93d4a0527c39';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Smart lock

About this step:
Created now so the handyman can be booked with one click the moment we have access. Covers the Yale front door lock and module, supply closet combination lock, back door lock (only if we have no back door key), garage code, and the back door key lockbox. Lock codes come from LastPass, not this task.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Install Locks template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = '66dc5646-0288-4ce5-8ae3-eb858c2cb8bc' AND md5(detail::text) = '0ba289fdbf3e686734597f2747d6128b';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Cameras

About this step:
Created now so the handyman can be booked with one click the moment we have access. Hardwired doorbell plus a solar spotlight camera with the clearest view of the front of the home and driveway. Needs Wi-Fi, so schedule after internet is installed.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the Install Ring Device / Connect to ARHA Ring Account template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = 'd3d12568-5842-4736-98c2-5b21b2464b97' AND md5(detail::text) = 'db0637d5788a6ca642f20a08c746c524';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Full furnishing homes only. When something is out of stock or delayed at ordering, the designer picks a replacement so ordering is not held up.

Instructions:
1. Watch Telegram for replacement requests from the PM.
2. Choose a replacement that fits the design and the budget, and update the pick list and Notion budget.
3. Tell the PM in Telegram. If the change is noticeable, the PM sends the owner the replacement approval from the situational library.

Done when:
Every requested replacement is chosen and the pick list is updated, or no replacements were needed.$w$ WHERE id = 'd65945dd-ea4b-4a33-a6a7-305b599b55ee' AND md5(detail::text) = 'e3b0640a2ba823cf37f7cef49ef016f1';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Created now so the handyman can be booked with one click the moment we have access. The detector ships with the Essentials order.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Install Carbon Monoxide Detector template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = 'c1fbc7bc-8a9d-44a0-a41d-37ca63bca9c0' AND md5(detail::text) = '549c5f829084cd1ffc0bea85a16b2aec';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Created now so the handyman can be booked with one click the moment we have access. When assigning, attach the window coverings grid from the Design Plan so the handyman knows which rod goes on each window.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Install Curtain Rods template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = '9d30cf1e-8dae-47b5-ad76-5de144ef22fb' AND md5(detail::text) = 'ca553dfd65055f0dbeb391a59ba3b7de';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Created now so the cleaner can be booked with one click the moment we have access. When assigning, enter the quantity of 108 inch and 96 inch panels and attach the window coverings instructions from the Design Plan.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Press Curtains template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = '9e6dcf79-221f-415e-98a8-eff6ec1adcb8' AND md5(detail::text) = 'fb121e7e63202e2e35dd9e1c1019204c';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Created now so the carpet vendor can be booked with one click the moment we have access. Only if the estimate includes carpet work. No template; follow the carpet rules in Request detailed repair estimates.

Instructions:
1. Create the work order in Breezeway with clear, specific instructions.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned. Or this step is marked not needed.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = '7230e418-82ac-4633-9e8b-ebaa9615f46b' AND md5(detail::text) = '2b43b05a5e0bd1167fd12306844b67f7';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Created now so the handyman can be booked with one click the moment we have access. Only for approved repairs. No template: be specific, use bullet points, and attach marked-up photos. Similar jobs can share a work order, but never combine furniture assembly with anything else (it is billed differently).

Instructions:
1. Create the work order in Breezeway with clear, specific instructions.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned. Or this step is marked not needed.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = '4dab5286-4811-413c-9b86-e6f2ac51ee6d' AND md5(detail::text) = 'f12329b9824239a965c2b37a5021154b';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Created now so the handyman can be booked with one click the moment we have access. Only for approved painting. Same writing rules as home repairs.

Instructions:
1. Create the work order in Breezeway with clear, specific instructions.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned. Or this step is marked not needed.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = 'cc5ba7ab-4f1e-4fd6-934a-05ffb22866a9' AND md5(detail::text) = '04e03cf2e7e8ae58c5099cb6231b86de';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Landscaping

About this step:
Created now so the handyman can be booked with one click the moment we have access. Only for approved landscaping. Same writing rules as home repairs. If the home is newly sodded, adjust the sprinklers; if there are none, let the owner know the risk.

Instructions:
1. Create the work order in Breezeway with clear, specific instructions.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned. Or this step is marked not needed.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = '4d405ddc-89ad-46e1-a83e-d2a0eeaaa19b' AND md5(detail::text) = '4bd517ef9a0b54118c22bc1ff8ed20c2';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Created now so the handyman can be booked with one click the moment we have access. When assigning, attach a PDF list of boxed furniture from the pick list (never the Smartsheet link). Ask for photos of assembled items and a note on anything missing.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Assemble Boxed Furniture template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = 'ecd8830d-3aca-4be3-954f-7d93e2109586' AND md5(detail::text) = 'b8a4f0e46001785f0f271f0083e018dc';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Created now so the handyman can be booked with one click the moment we have access. Schedule after furniture and TVs arrive so mounts can be centered. The TV mount instructions come over from the designer's step. Attach them when assigning.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Install TV Mounts template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = 'c0f6fd38-690e-4989-82b5-c79d2dfa6d20' AND md5(detail::text) = 'b745f236358d47c55f94ac19bfa81b0a';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Created now so the handyman can be booked with one click the moment we have access. Create two: one about halfway through the delivery window and one at the end. Add your name and email at the top of each.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Unbox Deliveries / Check for Damage template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = '81d5c0a3-a786-4e6e-8edb-e3be58980079' AND md5(detail::text) = 'f09b453b2d971253beeef74f7ec3edab';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Created now so the handyman can be booked with one click the moment we have access. Done ahead of staging to lighten the staging team's load.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Unbox/Clean Primary Dishware template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = '357d4b7e-6b58-4bd4-8c30-297dd485ec64' AND md5(detail::text) = '8ed410fe8aefb27d96d8a00486b05248';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Created now so the staging team can be booked with one click the moment we have access.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Setting out Essentials template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = '5520a82d-b3cd-4117-ac70-230e7d05917f' AND md5(detail::text) = 'df29f86b0dc9288757e6545649778739';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Created now so the cleaner can be booked with one click the moment we have access. When assigning, enter the number of king and queen sheet sets.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Make Beds template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = '89de1930-a898-43ad-8f07-ef6a9938e4e7' AND md5(detail::text) = '0ea9eb84bdbe1717437eee816cf96ac6';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Created now so the staging team can be booked with one click the moment we have access. When assigning, attach a public PDF of the decor pick list with order numbers, retailers, and prices removed. Never send the Smartsheet link.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Stage Decor template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = 'b1fc4747-cb38-42f7-a7e2-0406204e8a16' AND md5(detail::text) = '6271ee5c3a680c4734e7a863ea96fc8d';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Created now so the staging team can be booked with one click the moment we have access.

Instructions:
1. Click Dispatch to Breezeway to create the work order from the New House Setup - Setting Up Roku TVs template.
2. Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed.
3. Check this property is attached and the instructions are complete.

Done when:
The work order exists in Breezeway, unassigned.

Good to know:
Creating it early is the point. Assigning before closing is confirmed risks vendors showing up to a home we cannot get into.$w$ WHERE id = '4e7b52d3-08f5-496c-8b4d-6b50f4a3396b' AND md5(detail::text) = '32cf5648805e2e07fa836e64c5a204d9';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Most deliveries land in a 4 to 5 day window right after ordering. The staging team brings packages inside so they are not stacked in front of the home, which can lead to HOA or neighbor complaints. The goal: no packages delivered on weekends and never 10 or more left out overnight.

Instructions:
1. Create the work order in Breezeway from the New House Setup - Bring In Deliveries template. Leave it unassigned until after Access Confirmed.
2. After ordering in Ordering & Repairs, look at the expected delivery dates and assign the work order to the staging team for this home, scheduled across the 4 to 5 days when most packages arrive.
3. Post a heads up in the property Telegram group with the delivery dates and tag the stager for this home.

Timing rules for the staging team:
Packages arriving on a Friday: bring them in before the weekend.
Packages arriving over the weekend (avoid when ordering): bring them in Monday morning.
10 or more packages expected on one day: bring them in that same day so they are not left out overnight.

Done when:
The work order is drafted now, then assigned for the delivery window with the stager tagged in Telegram.

Good to know:
When ordering, aim for everything to arrive within 4 to 5 days and on weekdays. On Amazon, consolidate shipments (Amazon Day or fewer delivery days when offered) so the staging team can bring everything in at once.

If it stalls:
Closing or ordering moves: update the work order dates and repost in Telegram.$w$ WHERE id = 'd83bcb2c-5a46-4ac6-bc06-72b2ec64f767' AND md5(detail::text) = 'ecfcffa3085ce181db642985b96bab22';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Full furnishing homes only. The first of two approvals. The designer's next steps stay on hold until this one and the Onboarding Manager's budget review are both approved.

Instructions:
1. Open the mood boards, floor plans, and budget from the designer's submission.
2. Confirm there is a board for every space in the budget and the walkthrough video: entryway, hallways, living room, dining room, kitchen, and every bedroom.
3. Check each board against the ARHA design standards below.
4. Changes needed: send them to the designer in Telegram with specifics and review again once they are made.
5. Approved: tag the Onboarding Manager in Telegram for the budget review.

ARHA design standards:
Occupancy: plan seating and sleeping for up to 8 guests in a 4 bedroom and up to 6 guests in a 3 bedroom.
Boards: one for every space in the budget and in the walkthrough video, including the entryway, hallways, living room, dining room, kitchen, and every bedroom.
Seating: every main living area and the dining space seats the full occupancy. The kitchen has enough barstools to fill the countertop well.
Bedrooms: a king bed in the primary and queen beds in guest rooms, box springs where needed. Every bed has at least 2 accent pillows and 1 throw blanket. Every bedroom has at least 2 pieces of wall decor (art or a mirror). Add a full length mirror in at least 1 room when budget and space allow.
Study: a desk, desk chair, lamp, and accent chair. Skip bookcases and small decor, which get lost or go unused in a short-term rental.
Materials: wood or metal for barstools, bed frames, and large pieces whenever possible.
Living room furniture: gray or another color that hides stains and wear from guests.

Done when:
The design meets the standards and the Onboarding Manager has been tagged.$w$ WHERE id = '3ca504a8-80fb-4f09-bb62-d68fc2163c96' AND md5(detail::text) = '25b3cfab50b1b4697bc213b2933f5c7d';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Full furnishing homes only. The second approval. Once approved, the designer can export the owner mood boards and pick list.

Instructions:
1. Open the Notion onboarding budget.
2. Check the estimated margin is 16% or higher, every room is priced, and items come from the right vendor for the market.
3. Check the total lines up with the DFY furnishing estimate.
4. Changes needed: send them to the designer and Lead Designer in Telegram.
5. Approved: mark Budget Approved in Notion and tag the designer in Telegram to export the owner files.

Done when:
The budget is approved in Notion and the designer has been tagged.$w$ WHERE id = 'a5f0ddbd-1aaa-472a-b3af-22d9b9fb4284' AND md5(detail::text) = '9bc0f55287dd6351fb022b6df578672b';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Standard owner

About this step:
Standard owners only at this point. Active Owners get the estimate at Access Confirmed and their follow-up is 2 business days after access, in Ordering & Repairs.

Instructions:
1. Check Houzz Pro. If the owner approved, mark this step complete.
2. If not, send the email below and log the date on this task.

Subject: Re: {property address} Make Ready Estimate
Hi {owner first name},
I wanted to follow up on the make ready estimate. Have you had a chance to review and approve the items? We're ready to begin scheduling as soon as we hear from you so work can start right after closing.
If you'd like to talk through anything, just let me know!
Kindly,
{PM name}

Done when:
The estimate is approved, or a follow-up was sent and logged.

If it stalls:
No response 2 business days later: let the Director of Onboarding know.$w$ WHERE id = '5f240dcd-ec8d-4ee0-be20-20d295c66bac' AND md5(detail::text) = '58a0643dc8e6cf18ec6a446442134f34';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Full furnishing homes only. Opens once the design and budget are approved. Upload the instructions to this step and Resolve passes them to the PM's TV mount work order.

Instructions:
1. Standard: a 65 inch TV in the living room and a 55 inch TV in the primary bedroom. The budget notes any bonus room TV.
2. Mount TVs 4 inches above the mantle or dresser. Center the dresser on the wall opposite the bed, with the TV above it.
3. If the TV cannot be both centered on the wall and opposite the bed, choose opposite the bed unless the dresser would sit too close to a doorway.
4. Note any TV that sits on a stand instead of the wall.
5. Ask the installer to send a photo with the planned placement marked (painter's tape or drawn on the photo) for approval. The 4 inches is measured from the bottom of the TV, not the bottom of the mount.
6. Save as a PDF, upload it to this step, and tag the PM.

Done when:
The instructions are uploaded to this step and the PM has them.

Where it goes:
OneDrive / New House Setup Documents.$w$ WHERE id = '64a5d543-41df-4c52-813d-bdf7e2682726' AND md5(detail::text) = '91d291abd48296694e29f853b673fba5';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Full furnishing homes only. Opens once the design and budget are approved. The owner sees a clean design. The PM orders from the pick list.

Instructions:
1. Export the mood boards and floor plans as one PDF for the owner. No costs, prices, or product details anywhere on the boards.
2. Export the pick list to Excel. Keep the columns needed for ordering and remove client cost and design file links.
3. Add color and sizing for every piece (rugs, beds, box springs, and so on).
4. Save both to OneDrive and tag the PM in Telegram.

Done when:
Both files are saved and the PM has the pick list.

Where it goes:
OneDrive / New House Setup Documents.$w$ WHERE id = '48ce9f5c-22aa-44b3-933f-ceca0d01c9e5' AND md5(detail::text) = 'a6608a8289fa9c8e54be17192b379c64';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Full furnishing homes only. Owners approve the look before we order furnishings and decor. Standard owners receive them now. Active Owners receive them as opportunities within 1 to 2 days of closing, so prepare them now.

Instructions:
1. Standard owner: email the owner mood boards and floor plans PDF (no costs on the boards), CC the PM, using the email below.
2. Active Owner: check the opportunity fields on this step are filled in and the PDF is attached. The floor plans go out as a second opportunity at the same time: Review your floor plans (1 hour).
3. Make sure room names match across the mood boards and floor plans (Primary vs Bedroom 1).
4. Record the date shared on this task.

Subject: Your mood boards for {property address}
Hi {owner first name},
I hope you're doing well! Attached are the mood boards and floor plans for {property address}, with the furnishings and decor selected for each room.
If you're able to review them by {date, 3 business days out}, that would be a big help! The sooner we have approval, the sooner we can place orders once you close. Items take about a week to arrive. If we don't hear from you by then, we'll move forward with the selections as shown.
Once you close, we'll invoice 50% of the furnishing package so we can order. After everything is delivered, we'll invoice the remaining balance.
If anything isn't quite right, just reply with the room and item and we'll take care of it.
Kindly,
{Lead Designer name}

Done when:
Mood boards and floor plans are shared, or the opportunities are ready to release.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 1.5 (2 for larger homes) hours. Release: within 1 to 2 days of closing.$w$ WHERE id = '465ed7be-2ae9-497f-857f-447553df16c5' AND md5(detail::text) = '949a960ede6eca06cc8568e91fc8a714';
UPDATE public.onboarding_template_tasks SET opportunity = $w${"how": "Open the selection boards linked below and review each room. If everything looks good, mark this as reviewed. If you'd like changes, share your feedback in writing with the room name and item so we can respond quickly. Please complete your review by [date] to keep ordering and install on schedule. If we don't hear from you by then, we'll move forward with the selections as shown.", "why": "These boards set the look, feel, and function of your home before anything is ordered. Your input now makes sure the design reflects your goals for the property, fits your budget, and holds up to guest use. Once selections are approved, we move into ordering, so this is the best moment to weigh in.", "what": "Look through the selection boards for your home, room by room, including the furniture, decor, lighting, and finishes chosen for each space. Note anything you love, anything you'd like swapped, and any questions about how pieces will work for guests.", "title": "Review your selection boards"}$w$::jsonb WHERE id = '465ed7be-2ae9-497f-857f-447553df16c5' AND md5(opportunity::text) = '60efdc5723ebf4efc5bc1d6da186fb10';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
The PMA goes out within 1 business day of closing. Standard owners get the standard PMA. Active Owners get the Active Owner Program PMA.

Instructions:
1. Log into DocuSign as info@arealhomeaway.com (login in LastPass).
2. Choose the right PMA for the owner type and send it to every owner on the property.
3. Send the cover email below. If the home is owned by an LLC, keep the line about signing as the business.
4. Active Owner: the opportunity on this step releases when the PMA is sent. If the PMA was signed before the owner joined Resolve, use the Review your Property Management Agreement wording instead (2 hours).
5. Update the agreement status on the project to Sent.

Subject: Your Property Management Agreement for {property address}
Hi {owner first name},
We're looking forward to managing your home and working together.
Please review and sign the agreement sent to you through DocuSign at your earliest convenience. One quick note: please be sure to sign as your business entity, {LLC name}, rather than in your personal name.
If you have any questions at all, just let me know. We're happy to help.
Kindly,
{your name}

Done when:
The right PMA is sent to every owner and the status shows Sent.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Business Decision. Suggested time 1 hours. Release: when the PMA is sent.

If it stalls:
Not signed in 3 business days: send a short check-in and text the owner.$w$ WHERE id = '263f7c5c-5df2-4d0d-943d-e2603a0f8139' AND md5(detail::text) = '9d725a250f79c66c2af33e182bd114bb';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
The owner's first message after closing: congratulations and a week by week look at what happens next. Base the weeks on this project's real due dates, keep the end date open, and never promise a deadline.

Instructions:
1. Check the project dates are realistic before you write the weeks.
2. Standard owner: send the email below, CC the Onboarding Manager.
3. Active Owner: fill in the dates and repair items on this step's opportunity. It releases with the email so their review counts toward their hours.

Subject: Congratulations on closing!
Hi {owner first name},
Congratulations on closing! This is such an exciting step, and we're so glad to be part of it with you. Here's what the next few weeks look like:
Week 1 ({dates}): security cameras and digital door locks go in and Wi-Fi is set up. Repairs from your estimate begin, including {repair items}. Everything needed to stock your home is ordered, along with your furnishings and decor.
Week 2 ({dates}): our team unboxes, cleans, and stocks your home, and staging begins as furniture arrives, including curtains, TV mounts, and smart TV setup.
Week 3 ({dates}): a final deep clean and inspection, followed by professional marketing photos of your newly staged home.
Timelines can shift with product availability, shipping, and vendor schedules. We'll let you know right away if anything causes a delay.
Kindly,
{PM name}

Done when:
The owner has the timeline, by email or opportunity.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge. Suggested time 0.5 hours. Release: day of closing, alongside this email. The What You'll Do field runs near Resolve's 1,000 character limit, so keep edits short.$w$ WHERE id = 'f5b2335f-3aed-44ce-af1a-c119ec66d6c3' AND md5(detail::text) = '2382e46d2bfb62b1f997b8a65451b1f7';
UPDATE public.onboarding_template_tasks SET opportunity = $w${"how": "Read through each week of the schedule above. Keep in mind that timelines can shift with product availability, furniture shipping, assembly, and vendor schedules. We make every effort to keep things on track and will let you know right away if anything causes a delay.", "why": "Knowing what's happening and when helps you follow along with confidence and plan any visits around key milestones. It also sets clear expectations for when your home will be ready to welcome its first guests.", "what": "Review the week by week plan for getting your home guest ready:\n\nWeek 1 ([dates])\nHome access and security: Security cameras installed, digital door locks put in place, and Wi-Fi set up.\nHome improvements: Repairs from your estimate begin, including [repair items]. This work continues into Week 2.\nEssentials, furnishings, and decor: Everything needed to stock your home is ordered, along with all furnishings and decor based on the design developed for your home.\n\nWeek 2 ([dates])\nCleaning and stocking: Once essentials arrive, our team unboxes, cleans, and stocks your home.\nStaging begins: As furniture arrives, our stagers set up each room according to the design plan.\n\nWeek 3 ([dates])\nFinal touches and photos: A final deep clean and inspection, followed by professional marketing photos.", "title": "Review your onboarding schedule"}$w$::jsonb WHERE id = 'f5b2335f-3aed-44ce-af1a-c119ec66d6c3' AND md5(opportunity::text) = '7b5d0c64141a4418ed5cab397419b442';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Closing documents give us accurate ownership, title, and HOA records for the life of the home.

Instructions:
1. Ask the realtor or owner for the settlement statement, deed, title policy, and any HOA disclosures.
2. Active Owner: the opportunity on this step asks them to upload these directly.
3. Save everything to OneDrive / Contract and Closing Documents.

Done when:
The closing documents are saved in OneDrive.

Good to know:
Active Owner opportunity settings: response types Upload / Documentation. Suggested time 0.5 hours. Release: day of or day after closing.$w$ WHERE id = 'fb7b4ae6-23cf-44aa-9dfb-7e023f45e514' AND md5(detail::text) = '00c6bddfb58afe9e6c961b74eabdafd3';
UPDATE public.onboarding_template_tasks SET opportunity = $w${"how": "Gather your final closing documents, including your settlement statement, deed, title policy, and any HOA disclosures. Upload them here as PDFs or clear photos. If anything is still pending from your title company, upload what you have and add the rest once it arrives.", "why": "Your closing documents help us keep accurate property records, support your accounting and tax reporting, and give us quick access to details like ownership, title, and HOA information if questions come up while we manage your home.", "what": "Once closing is complete, upload copies of your closing documents so we have a complete record for your home.", "title": "Share your closing documents"}$w$::jsonb WHERE id = 'fb7b4ae6-23cf-44aa-9dfb-7e023f45e514' AND md5(opportunity::text) = '11613dde15739d2ead8a03c9548b7505';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Large furniture sets the staging schedule, so it is ordered first. Wait for the owner's mood board approval and the Lead Designer and budget approvals before ordering.

Instructions:
1. Confirm the design and budget are approved and the owner approved the mood boards.
2. Order from the market's vendor: Urban Styles for Indy, Living Spaces for Oklahoma and Texas.
3. Schedule delivery. Hardwood bedrooms: rugs must arrive before beds.
4. Mark each item purchased on the pick list with its delivery date.
5. Use the correct card from the purchasing guide and log the expense: https://arha.fillout.com/t/5sFHdVHE6nus

Done when:
Large furniture is ordered, delivery is scheduled, and the pick list shows dates.$w$ WHERE id = '0e3a9a36-d13d-4476-91f7-5d102a876efa' AND md5(detail::text) = 'ae991dd6a705408d01ce360aa6b70dd8';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Everything else on the pick list. Aim for all of it to land in the same 4 to 5 day weekday window as essentials.

Instructions:
1. Order every item on the furnishings and decor pick list.
2. Choose consolidated or scheduled delivery wherever offered.
3. Mark each item purchased with its delivery date on the pick list.
4. Out of stock or delayed: ask the designer for a replacement in Telegram.
5. Log every expense: https://arha.fillout.com/t/5sFHdVHE6nus

Done when:
Everything on the pick list is ordered with delivery dates.$w$ WHERE id = 'be26109e-1bca-4f78-9ffd-7434ee7bcf33' AND md5(detail::text) = 'da7706b1b8aac1ee35c4cf98ba5488bf';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: New appliances

About this step:
Only for homes that need new appliances. Appliances are purchased after closing.

Instructions:
1. Confirm which appliances the home needs. If there are existing appliances, they are tested during the Pre-Work Inspection; message the Director and Onboarding Manager before replacing any.
2. Order from Lowe's and schedule delivery, ideally the same day as large furniture.
3. Preferred models: washer GTW485ASWWB, dryer GTD48EASWWB, refrigerator GRSC2352AF. Goal: under $2,800 including delivery.
4. Check the washer, dryer, and refrigerator spaces, and the refrigerator door swing, before ordering.
5. Log the expense: https://arha.fillout.com/t/5sFHdVHE6nus

Done when:
Appliances are ordered and delivery is scheduled.$w$ WHERE id = '0b3d89c4-95ba-4857-b502-d7a0be4ca676' AND md5(detail::text) = '4ae7d23b630cc9072d708d3bdc01331a';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Active Owner

About this step:
Active Owners receive the estimate at Access Confirmed. Repairs cannot be scheduled until they approve.

Instructions:
1. Check the Make Ready Estimate opportunity. Approved: mark this complete.
2. Not yet: send a short note in Resolve or by email asking them to review, and offer a quick call.
3. No response in 2 more business days: tell the Director of Onboarding.

Done when:
The estimate is approved, or the follow-up is logged.$w$ WHERE id = '2f5d9990-53ca-4af2-bba6-022d31bf4532' AND md5(detail::text) = '4669f858d6978fc78d4453ceae5c845d';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Active Owner

About this step:
Active Owners only. Accounting sends Invoice 1 through QuickBooks either way. This opportunity lets the owner review it and confirm payment in Resolve so it counts toward their participation.

Instructions:
1. Once Accounting sends the Invoice 1 QuickBooks link, fill in this home's amounts and timing on the opportunity.
2. Attach the Furnishing Invoice Breakdown and the approved Make Ready Estimate.
3. Release the opportunity.

Done when:
The opportunity is released with this home's amounts.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Upload / Documentation. Suggested time 0.25 hours. Release: once Accounting sends the Invoice 1 QuickBooks link.$w$ WHERE id = 'c8e7a719-a1b6-4018-83cc-eb95a9f909c2' AND md5(detail::text) = 'ecefd8c503ca197d908460d724fc5fd4';
UPDATE public.onboarding_template_tasks SET opportunity = $w${"how": "1. Review the attached Furnishing Invoice Breakdown and Make Ready Estimate.\n2. Open your invoice using the QuickBooks link sent to your email and submit payment.\n3. Come back here and confirm payment has been made. You can also upload your payment confirmation.", "why": "Invoice 1 covers half of your furniture package and half of your make ready estimate, which allows us to place furniture orders and begin make ready work on schedule. Timely payment keeps your home on track for launch.\n\nHere's what to expect for the remaining invoices:\nInvoice 2 will be sent in two weeks and covers the second half of your furnishing expenses.\nInvoice 3 is your final invoice and covers the second half of your make ready estimate. If anything changes on the make ready estimate, we'll adjust the cost on this invoice.", "what": "Review your first onboarding invoice for [Property Address] and submit payment through the QuickBooks link. Once paid, confirm here so we can keep your project moving.\n\nYour total onboarding investment:\nFurnishing Package: $[amount]\nMake Ready Estimate: $[amount]\nInvoice 1: $[amount], half of your furnishing package plus half of your make ready estimate.", "title": "Review and pay your first onboarding invoice"}$w$::jsonb WHERE id = 'c8e7a719-a1b6-4018-83cc-eb95a9f909c2' AND md5(opportunity::text) = '2b331a4707b568a907cb8d13232772aa';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Someone is on site to direct placement, check for damage, and place mattresses.

Instructions:
1. Create the work order from the New House Setup - Meet Furniture Delivery template for the delivery date.
2. Attach the floor plans with every bedroom labeled and the furniture for each room noted.
3. Attach the list of items being delivered with photos from the pick list.
4. The template asks them to check items against the list, photograph damage, remove packing and tags, place mattresses, and tell you if the delivery does not show.

Done when:
The delivery work order is assigned with floor plans and the item list.$w$ WHERE id = '2ecfa855-d576-44a2-9298-f8cdbaa77910' AND md5(detail::text) = 'c7343b6f290a4d15cad52db8ea24e941';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: New appliances

About this step:
New appliances are checked and tested right after delivery.

Instructions:
1. Create the work order from the New House Setup - Meet Appliance Delivery & Test Appliances template.
2. If no one needs to be present for delivery, schedule the test soon after.
3. The template covers checking for damage, a washer test load, running the refrigerator water and ice, removing packing, and placing manuals on the supply closet top shelf.
4. Ask for a photo of each appliance label. The Mid-Project Review needs them.

Done when:
The work order is assigned and label photos will come back with it.$w$ WHERE id = 'c4b50f1c-38c3-4f5d-b486-a59f66192fc1' AND md5(detail::text) = '776714a72580233a84e26eee4a781ebb';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
The Pre-Work Inspection checks the home before work begins. It surfaces filters to order, interior cameras, garage remotes, and anything the owner needs to approve.

Instructions:
1. Open the results: https://www.notion.so/arealhomeaway/Pre-Work-Inspections-2c94658d5f4f80a0bcddcdb0577015ab
2. Order air filters in the sizes and quantities listed, and a refrigerator water filter if the fridge is not new. Add installation to a handyman work order.
3. Interior cameras: guests cannot have cameras inside. Get a handyman quote to remove them.
4. Garage remotes: if there are fewer than 2, order more and add programming to a work order.
5. Anything needing approval: Active Owners get the opportunity on this step. Standard owners get a short email listing what we found and what we recommend.
6. Tell the Onboarding Manager the results are reviewed so they can be added to the PID.

Done when:
Filters and remotes are ordered, cameras are handled, and owner approvals are requested.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Business Decision. Suggested time 0.25 hours. Release: after the Pre-Work Inspection. If nothing needs approval, remove that section and uncheck Business Decision.$w$ WHERE id = 'f7c9426a-4642-47f2-b7ec-cfef65b45b94' AND md5(detail::text) = '858e9b2c4ca1fc6a799e262040bb1287';
UPDATE public.onboarding_template_tasks SET opportunity = $w${"how": "1. Review the attached pre-work assessment.\n2. Under Business Decision, approve each recommended item or let us know if you'd prefer another option.\n3. Leave a note with any questions.", "why": "Catching these items early keeps your home on schedule, avoids surprise costs later, and makes sure it meets listing site standards and guest expectations from day one.", "what": "Review the findings from our pre-work inspection of your home and approve any recommended changes.\n\nNeeds your approval:\n[Item, what we found, what we recommend, and why. Repeat for each.]\n\nAlready completed:\n[Small fixes handled during inspection and the benefit to you. Repeat for each.]\n\nEverything else checked out: [systems that passed].", "title": "Review your pre-work assessment"}$w$::jsonb WHERE id = 'f7c9426a-4642-47f2-b7ec-cfef65b45b94' AND md5(opportunity::text) = 'f4b6c640b46614a8df51e6d4ff0e29be';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Owners hear from us every week until handoff. Repeat this step each week.

Instructions:
1. Write the update with what was completed, what is in progress, what is next, and anything waiting on the owner.
2. Active Owner: duplicate the opportunity on this step and change only the bracketed sections.
3. Standard owner: send the email below.

Subject: {property address}: this week's update
Hi {owner first name},
Here's where everything stands this week. We finished {what was completed}. Right now we're working on {what is in progress}{, and here's what we're doing about any delays}.
Next week we'll {next two or three milestones}.
{One thing we need from you, or: Nothing needed from you this week.}
Kindly,
{PM name}

Done when:
This week's update is sent or released.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge. Suggested time 0.1 hours. Release: every week until handoff.$w$ WHERE id = '00f4e66f-ce9c-43fc-b1bb-e74fc94ad83f' AND md5(detail::text) = '3e67ec8be8a2fcf1a9be2160fd2b5b17';
UPDATE public.onboarding_template_tasks SET opportunity = $w${"how": "Read through the update and photos, then select Acknowledge. If you have questions, leave a note and your project manager will follow up.", "why": "Weekly updates keep you in the loop without having to chase details, and give you a regular moment to ask questions before anything becomes a surprise.", "what": "Catch up on everything that happened at your home this week. No action needed beyond a quick read, unless something below is marked for your input.\n\nCompleted this week:\n[What was finished]\n\nIn progress:\n[What is underway and any delays]\n\nComing up next week:\n[Next two or three milestones]\n\nNeeds your input:\n[Anything waiting on you, or Nothing this week]", "title": "Your weekly progress update: week of [date]"}$w$::jsonb WHERE id = '00f4e66f-ce9c-43fc-b1bb-e74fc94ad83f' AND md5(opportunity::text) = '14d54c691830b5167bc47f72b4fa8beb';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Full furnishing homes only. The staging team sets up each room from these, so they reflect any replacements.

Instructions:
1. Duplicate the staging instructions template in Canva. The Onboarding Manager can share the Canva login if you do not have one.
2. Show each room's layout and decor placement, including replacements.
3. Export as a PDF, upload it to this step, and tag the PM in Telegram that it is ready to send to the staging team.

Done when:
The staging instructions PDF is uploaded and the PM has it.$w$ WHERE id = 'ed2b7c4a-33b3-4d67-bb77-b4b00012c71d' AND md5(detail::text) = '767d37dda3fa3e27b979f97aac0a2dc8';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
The staging team works from the designer's staging instructions and the PM's task summary sheet, which lists every work order and its date.

Instructions:
1. Confirm replacements are reflected in the designer's staging instructions.
2. Build the task summary sheet from the work order dates.
3. Send both to the stager in Telegram.

Done when:
The stager has the staging instructions and the task summary sheet.$w$ WHERE id = '043ebbe2-7634-4db3-b183-44470450922e' AND md5(detail::text) = '5e1a4a0201b678eb8068685ddd17dfd7';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Active Owner

About this step:
Active Owners approve the staging plan before stagers set up.

Instructions:
1. Attach the staging instructions PDF to the opportunity on this step.
2. Add any home-specific notes under How to complete it.
3. Release it before staging starts.

Done when:
The staging plan opportunity is released before staging.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 0.5 hours. Release: before stagers set up.$w$ WHERE id = '5f4f7199-301b-4c0b-9b65-92b95d7c805f' AND md5(detail::text) = '89656abc1b483b0b8e37dbe9a1f05bf5';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Done the same day the TVs go in. The staging team requests activation and the PM approves it from the info email.

Instructions:
1. When the stager requests it, log into the info email (LastPass) and approve each activation.
2. Rename each Roku device to the property address and the room it is in.
3. Update the Roku tracker: https://www.notion.so/arealhomeaway/1d74658d5f4f80d48b7ae7309c0333f1

Done when:
Every Roku is activated, named, and tracked.$w$ WHERE id = 'a221c720-e5ca-4a31-9ece-c3c4e3ee6bd1' AND md5(detail::text) = '0347bb85f557a8edeadb1be1d11ed9ff';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
Repairs, paint, carpet, and landscaping are checked and approved before staging fills the space.

Instructions:
1. Review each completed work order in Breezeway with its photos.
2. Approve the work or send it back with notes.
3. Record the actual cost of each job in the Repair & Improvement Report.
4. Active Owner: list what was done on this step's opportunity with the walkthrough video and photos, and release it.

Done when:
Every repair is approved and its cost is recorded.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 0.5 hours. Release: when make ready repairs are complete.$w$ WHERE id = '0c1c8908-c896-4c9e-b286-a28d3c41c79e' AND md5(detail::text) = '55d5a55c012069a5e65672680a80f3c3';
UPDATE public.onboarding_template_tasks SET opportunity = $w${"how": "1. Watch the walkthrough video.\n2. Review the before and after photos.\n3. Select Acknowledge to approve everything, or leave a note on anything you'd like us to take a second look at. The room name or video timestamp helps us find it quickly.", "why": "Signing off on completed repairs lets us close out this phase and keep your home on track for launch. If anything doesn't look right, now is the easiest time to address it, before furniture and staging fill the space.", "what": "Review the finished repair work at your home and let us know if you approve. This includes:\n\n[Area]: [repair completed]\n[Area]: [repair completed]", "title": "Review and approve completed repairs"}$w$::jsonb WHERE id = '0c1c8908-c896-4c9e-b286-a28d3c41c79e' AND md5(opportunity::text) = '5a9d7edd80d6d3faed21b37891a28e56';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Active Owner

About this step:
Active Owners only. Invoice 2 goes out about 2 weeks after the first invoice is requested. This reminder lets the owner pay and confirm it in Resolve.

Instructions:
1. Confirm with Accounting that Invoice 2 was sent.
2. Fill in the amount on the opportunity and release it.

Done when:
The reminder is released and Invoice 2 is sent.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Upload / Documentation. Suggested time 0.25 hours. Release: 2 weeks after the first invoice is requested.$w$ WHERE id = '4b713536-e247-4329-b6af-ff4176ec42c6' AND md5(detail::text) = '697cfa529bf11e8b58bc2410c9d18547';
UPDATE public.onboarding_template_tasks SET opportunity = $w${"how": "1. Open your invoice using the QuickBooks link sent to your email.\n2. Submit payment through QuickBooks.\n3. Come back here and confirm payment has been made.", "why": "This completes your furnishing payment. Your final invoice will cover the second half of your make ready estimate once we've reviewed the actual costs.", "what": "Your second onboarding invoice for [Property Address] has been sent through QuickBooks. It covers the second half of your furnishing package: $[amount]. Submit payment and confirm here.", "title": "Pay your second onboarding invoice"}$w$::jsonb WHERE id = '4b713536-e247-4329-b6af-ff4176ec42c6' AND md5(opportunity::text) = '54212bae4a3cd54e4491b94e8551cd79';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Cameras

About this step:
Signs, the stick-up camera, and the hedge delivery box come down at least 1 day before photos.

Instructions:
1. Create a handyman work order to remove the surveillance signs, the Ring stick-up camera, and the hedge delivery box.
2. Schedule it at least 1 day before the photo shoot.

Done when:
The work order is scheduled before the shoot.$w$ WHERE id = '36881d78-d434-489b-bf51-fd35022fe2e3' AND md5(detail::text) = '002339b3f5d5d08b1fb91c4d17a338fc';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Active Owner

About this step:
Active Owners get a room by room look at their finished home before professional photos.

Instructions:
1. Ask the stager for room by room photos when staging is complete.
2. Attach them to the opportunity on this step and release it.

Done when:
The staged home opportunity is released with photos.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 0.5 hours. Release: after staging is fully complete.$w$ WHERE id = '1437d187-fc9a-4959-9463-146a89e2a049' AND md5(detail::text) = '242094cad722a6c200713a4711a67ad5';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Active Owner

About this step:
Active Owners only. The owner schedules their cost segregation study with their provider once staging is done, so every furnished element is documented in one walkthrough. Our onsite partner walks the provider through the home on a video call.

Instructions:
1. Fill in the window and onsite partner on this step's opportunity and release it once staging is complete.
2. The owner schedules the study and shares the date in their response. Resolve notifies you when they respond.
3. Schedule the onsite partner for that date and confirm it back to the owner.
4. No date after 3 business days: follow up with the owner.

Done when:
The owner has shared the study date and the onsite partner is scheduled.

Good to know:
Active Owner opportunity settings: response types Business Decision, Written Feedback. Suggested time 0.5 hours. Release: once staging is complete.$w$ WHERE id = '2dc6f929-eaa5-4e9c-afd0-56400784ad9e' AND md5(detail::text) = 'c38a08b95e6a6049170a8475f133d9de';
UPDATE public.onboarding_template_tasks SET opportunity = $w${"how": "1. Schedule the study with your provider for the [X to X] window following staging.\n2. Share the confirmed date and time here so we can coordinate [Onsite Partner]'s availability.\n3. Let us know if your provider has any specific requirements for the walkthrough.", "why": "Once staging is complete, the home is fully furnished and set up exactly as it will operate. Scheduling the study at this point allows every element of the home to be documented in one walkthrough, so nothing is missed and no follow up visit is needed.", "what": "As part of your Active Owner Program, a cost segregation study is required for your home. Schedule the study with your provider for the [X to X] window following staging completion. The study is conducted on a video call, and [Onsite Partner], our onsite partner, will walk the provider through the entire home room by room. You do not need to be onsite.", "title": "Schedule your cost segregation study walkthrough"}$w$::jsonb WHERE id = '2dc6f929-eaa5-4e9c-afd0-56400784ad9e' AND md5(opportunity::text) = 'ba809817854941e5c3eb849a9937e1f2';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Furnishing Package selected

About this step:
Unused decor and extra items are returned or moved to another home.

Instructions:
1. Ask the stager for photos of anything unused.
2. Return what can be returned.
3. Anything that cannot be returned: tell the Onboarding Manager so it can go to another home.

Done when:
Unused items are returned or allocated.$w$ WHERE id = '890d1744-2c7e-4e17-9762-cd90769023ad' AND md5(detail::text) = '780407b83ffcc28b434e67263c682045';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
The listing is built now and goes live after the handoff meeting.

Instructions:
1. Upload the online photos in this order: a strong main living area cover photo, front exterior, entryway, living area, kitchen, dining, primary bedroom, primary bath, guest bedrooms and baths, bonus spaces, laundry, back patio, backyard, neighborhood amenities.
2. Caption every photo with the room name.
3. Update the descriptions, accommodations, and guest instructions using the guide: https://www.notion.so/arealhomeaway/OwnerRez-Uploading-Photos-and-Updating-Property-Information-2024-1c14658d5f4f801db565d823c6a61e88
4. Community pool limited by the HOA: add the note that pool access is only for reservations of 30 days or longer.
5. Review every description before handoff.
6. Active Owner: attach the listing link to this step's opportunity and release it.

Done when:
Photos, captions, and listing content are complete in OwnerRez.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 1 hours. Release: after professional photos are uploaded.$w$ WHERE id = '5b46375b-3795-44a9-aef1-13f28d73541a' AND md5(detail::text) = '8ff9a8dc11f7ccce6084d3080fe23dc3';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Smart lock

About this step:
Breezeway creates guest and vendor codes through Yale, so the lock has to be connected and active.

Instructions:
1. In Breezeway, open Devices, then Device Settings, then View Devices.
2. Find the property's lock (its name matches the Yale app) and select it to activate. Confirm it shows under Active Properties.
3. Create the BW Master Code access code (from LastPass) with Never expires.
4. If the lock is not connected in the Yale app, ask the staging team to connect it before the handoff meeting.
5. After the Final Inspection is in the PID, add the BW Master Code to the PID access codes.

Done when:
The lock is active in Breezeway with the master code, and the PID is updated.$w$ WHERE id = 'ab3df464-a27d-48d9-a662-79c0830dd019' AND md5(detail::text) = '1c1e6299be6e69b9b78405e3e7ef2fa9';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Cameras

About this step:
The owner paid for a 1 year Ring subscription. It starts as a 30 day trial and must be activated before handoff.

Instructions:
1. Log into the ARHA Ring account (LastPass) and select the property.
2. Purchase the Home Basic Annual Subscription for the doorbell camera only. Guide: https://www.notion.so/arealhomeaway/Purchase-Ring-Annual-Subscription-for-a-New-Property-1c54658d5f4f8094be64db71f73f55e5
3. Confirm every device is online and fully charged by hardwire or solar.

Done when:
The subscription is active and every device is online.$w$ WHERE id = '2533acff-c621-4ba2-bd50-15bc2e5b7cfe' AND md5(detail::text) = '5e2aa591c49111b26a1b31182d259492';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
The Final Inspection is the home's operating record: supply box, garage openers and lockbox keys, Wi-Fi and router, TVs, thermostat, appliances, trash, and mailbox.

Instructions:
1. Open the results: https://www.notion.so/arealhomeaway/Final-Inspections-Database-View-2c94658d5f4f80aca9f9c13c38a314c0
2. Follow up on anything concerning and correct answers with Adjust Responses.
3. Tell the Onboarding Manager it is reviewed so it can go into the PID.
4. Active Owner: attach the Final Assessment PDF to this step's opportunity and release it.
5. Details still missing that only the owner knows: create this one-off opportunity:

Title: Share a few missing details about your home
What you'll do: A few details about your home are still missing from our records: [items]. Share what you know so our Operations team starts with complete information.
Why this matters: These details go into the instructions guests and our team rely on. Filling them in now prevents questions during the first stays.
How to complete it: Answer each item in the feedback field. Upload a photo or document if it helps.

Done when:
The results are reviewed and the Onboarding Manager knows.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 0.5 hours. Release: after the Final Inspection.$w$ WHERE id = '8c28732f-acc8-40a9-a6e6-0cc3f33fc165' AND md5(detail::text) = '8dcaa455c8dcb7f36cf83539551d2a3d';
UPDATE public.onboarding_template_tasks SET opportunity = $w${"how": "Open the attached Final Assessment, review each section, and leave a note on anything incorrect or missing. Select Acknowledge once everything looks right.", "why": "These details become your home's operating record and shape the instructions guests rely on when they arrive. You know your home best, so flagging anything now means our Operations team starts with accurate information from the first booking.", "what": "Look through the attached Final Assessment for [Property Address] and let us know if anything looks incorrect or missing. This is our last walkthrough before your home moves to our Operations team. It confirms the guest supply box, garage door openers and lockbox keys, WiFi and router location, TV setup, thermostat, appliances, trash and recycling, and mailbox details.", "title": "Review your Final Assessment"}$w$::jsonb WHERE id = '8c28732f-acc8-40a9-a6e6-0cc3f33fc165' AND md5(opportunity::text) = '4bf4ee7233c58f21d95c79c2c84a0c6d';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
The owner sees the full cost picture before handoff, with anything that changed already explained.

Instructions:
1. Standard owner: send the email below with the cost breakdown attached.
2. Active Owner: attach the breakdown to this step's opportunity and release it with the QuickBooks link once Accounting sends it.
3. Scope or cost changed from the approved estimate and was not approved yet: use the situational library item Approve an added repair first.

Subject: {property address}: Final Onboarding Costs
Hi {owner first name},
Thank you so much for your patience while we waited for all of the onboarding costs to come in. I've attached a full breakdown of the make ready work at {property}.
We've talked through most of the items that came up during onboarding, so nothing in here should be a surprise. {Credit or balance sentence.}
The invoice will go to our accounting team tomorrow and will be sent over to you shortly after.
If you have any questions at all, {PM name} and I are both happy to clarify anything that was done.
Kindly,
{your name}

Done when:
The owner has the final costs by email or opportunity.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Upload / Documentation. Suggested time 0.5 hours. Release: after the Director approves the final costs.$w$ WHERE id = '98efdfb5-e68c-4b84-a059-e67aca03df17' AND md5(detail::text) = 'fff9a8a20cc532e40ed4e20b97efc7e1';
UPDATE public.onboarding_template_tasks SET opportunity = $w${"how": "1. Review the attached cost breakdown.\n2. Open your final invoice using the QuickBooks link sent to your email.\n3. Submit payment through QuickBooks.\n4. Come back here and confirm payment, or leave any questions in the feedback field.", "why": "Your final invoice reflects the actual cost of the work completed at your home. Any credit from the original estimate is already applied, so this closes out your onboarding costs before your home launches.", "what": "Review the final breakdown of your onboarding costs for [Property Address], compare it to your approved estimate, and pay your final invoice through the QuickBooks link.", "title": "Review your final onboarding costs and pay your final invoice"}$w$::jsonb WHERE id = '98efdfb5-e68c-4b84-a059-e67aca03df17' AND md5(opportunity::text) = '4ef919ba1e45f0ea3592e03ebd42763e';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Active Owner

About this step:
Operations drafts guest instructions from the Final Assessment. Active Owners review them because they know the home best.

Instructions:
1. Get the drafted guest instructions from Operations.
2. Attach them to the opportunity on this step and release it.
3. Send any corrections back to Operations.

Done when:
The owner has reviewed the guest instructions and corrections are with Operations.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 0.5 hours. Release: after Operations drafts them.$w$ WHERE id = 'cbb23216-ee09-4301-b0b0-4392a960a145' AND md5(detail::text) = 'c9819bd29934310cbdf59d3133765c39';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: Active Owner

About this step:
A short meeting with the Active Owner before launch to walk through the listing, the pricing approach for the first months, and what happens once guests book. Emily, our COO, hosts it. Add it even if it is scheduled by calendar so the hours count.

Instructions:
1. Ask Emily to schedule and host the meeting before handoff, and share the listing link and anything the owner has asked about.
2. Release the opportunity on this step when it is scheduled.
3. Add notes from the meeting to this step.

Done when:
The meeting is held and notes are saved.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 1 hours. Release: when the meeting is scheduled.$w$ WHERE id = '02dff9fa-3046-42e2-beb2-f9de1f9871d6' AND md5(detail::text) = 'e6032418b5033d646e20893c37d0b995';
UPDATE public.onboarding_template_tasks SET opportunity = $w${"how": "Join the meeting at the scheduled time. Log the time you spent and add any notes or questions in the feedback field.", "why": "Launch is when your investment starts working. Knowing the plan for pricing, reviews, and the first stays helps you follow along with confidence.", "what": "Join a short meeting with our team before your home launches to walk through your listing, our pricing approach for the first few months, and what to expect once guests start booking.", "title": "Join your launch preparation meeting"}$w$::jsonb WHERE id = '02dff9fa-3046-42e2-beb2-f9de1f9871d6' AND md5(opportunity::text) = 'f93a8726a4237e82b8e9d5c06f7c4d37';
UPDATE public.onboarding_template_tasks SET detail = $w$About this step:
The handoff meeting passes the home from Onboarding to Operations and reviews anything still open.

Instructions:
1. Walk through the handoff form and every outstanding item with the Director of Onboarding and Operations.
2. Confirm all invoices are reviewed and approved.
3. Active Owner: the owner joins and the opportunity on this step logs their time.
4. Note who owns each open item after handoff.

Done when:
The meeting is held and every open item has an owner.

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 1 hours. Release: at handoff.$w$ WHERE id = '10c0f56a-e094-4b6c-9e11-24bd8e55e6b1' AND md5(detail::text) = '4bd7e9d41dc40e1361ebdf62c2d5935a';
UPDATE public.onboarding_template_tasks SET opportunity = $w${"how": "Join the meeting at the scheduled time. Log the time you spent and add any notes or questions in the feedback field.", "why": "This is the moment your home moves from setup to running. Hearing the handoff firsthand means you know who to contact, what is still being finished, and what happens next.", "what": "Join the handoff meeting where our Onboarding team hands your home to our Operations team, reviews any outstanding items, and confirms your home is ready for its first guests.", "title": "Join your handoff meeting"}$w$::jsonb WHERE id = '10c0f56a-e094-4b6c-9e11-24bd8e55e6b1' AND md5(opportunity::text) = '9c3ef961a589ee0890c388059cdf9744';
UPDATE public.onboarding_template_tasks SET detail = $w$Applies only when: HOA

About this step:
HOA rules can restrict short-term rentals, fences, signage, and amenity use. Kade reviews the CC&Rs so we know early whether anything affects how this home can be rented or set up. His review feeds the STR review in Pre-Close.

Instructions:
1. Ask the realtor for the current HOA covenants (CC&Rs) if we don't have them.
2. Upload them to this step and save them to OneDrive / HOA Covenants.
3. Add them to the property's row on the Notion CC&R review page: https://app.notion.com/p/arealhomeaway/1d84658d5f4f80c39ef0d99f6403220f
4. Email kade@arealhomeaway.com with the Notion link and ask for his review.
5. No HOA: record No HOA on the project and in Notion, let Kade know, and mark this complete.

Done when:
The CC&Rs are saved and Kade has been asked to review them, or No HOA is recorded.

If it stalls:
Kade hasn't finished 3 business days after you sent them: follow up with him directly.$w$ WHERE id = '7460f7e9-39ad-40ba-9319-d6ac31d22e35' AND md5(detail::text) = '7451b1d52a5484eee0b0fd50883a4839';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "provider", "type": "text", "label": "Provider"}, {"key": "service_type", "type": "text", "label": "service type"}, {"key": "start_date", "type": "date", "label": "start date"}, {"key": "billing_method", "type": "text", "label": "billing method"}, {"key": "account_last_4_digits", "type": "text", "label": "account last 4 digits"}, {"key": "support_number", "type": "text", "label": "support number"}]$w$::jsonb WHERE id = 'f33320db-5d7e-49e7-a846-bac67f0019d2' AND md5(output_fields::text) = '2a9ff8f39e42f97c894c254f46ec8a5b';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "internet_provider", "type": "text", "label": "Internet provider"}, {"key": "speed", "type": "text", "label": "speed"}, {"key": "monthly_cost", "type": "money_text", "label": "monthly cost"}, {"key": "install_date", "type": "date", "label": "install date"}, {"key": "trash_provider", "type": "text", "label": "trash provider"}, {"key": "pickup_day", "type": "text", "label": "pickup day"}, {"key": "cart_count", "type": "number", "label": "cart count"}]$w$::jsonb WHERE id = '9bf0b513-ea20-4987-afb8-1623e1b7ffb9' AND md5(output_fields::text) = 'bc28a6a77e75d9ad7816bd257ac2ce33';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "category", "type": "text", "label": "Category"}, {"key": "decision", "type": "text", "label": "decision"}, {"key": "proposed_item", "type": "text", "label": "proposed item"}, {"key": "quantity", "type": "number", "label": "quantity"}, {"key": "budget", "type": "money_text", "label": "budget"}, {"key": "guest_need", "type": "text", "label": "guest need"}]$w$::jsonb WHERE id = '87c4047f-8323-4cef-b529-63f8076af934' AND md5(output_fields::text) = '31443f9f40b986e3dfc800aa99aa6d61';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "category", "type": "text", "label": "Category"}, {"key": "decision", "type": "text", "label": "decision"}, {"key": "item", "type": "text", "label": "item"}, {"key": "quantity", "type": "number", "label": "quantity"}, {"key": "function", "type": "text", "label": "function"}, {"key": "budget", "type": "money_text", "label": "budget"}, {"key": "priority", "type": "text", "label": "priority"}]$w$::jsonb WHERE id = '9ae07243-01fe-47cf-8ae0-c30a784d5a3b' AND md5(output_fields::text) = 'fa330b21b4b8a6c8359b3f8c0e530f52';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "category", "type": "text", "label": "Category"}, {"key": "provider", "type": "text", "label": "provider"}, {"key": "price", "type": "money_text", "label": "price"}, {"key": "frequency", "type": "text", "label": "frequency"}, {"key": "contract_terms", "type": "text", "label": "contract terms"}, {"key": "recommendation", "type": "text", "label": "recommendation"}]$w$::jsonb WHERE id = '78d72847-64c8-4155-9555-874cc7a28b5a' AND md5(output_fields::text) = '6aa1aecc305c4c80a7c050716ca4187a';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "bedrooms", "type": "number", "label": "Bedrooms"}, {"key": "baths", "type": "number", "label": "baths"}, {"key": "sleeping", "type": "text", "label": "sleeping"}, {"key": "parking", "type": "text", "label": "parking"}, {"key": "access", "type": "text", "label": "access"}, {"key": "amenities", "type": "text", "label": "amenities"}, {"key": "quirks", "type": "text", "label": "quirks"}, {"key": "open_questions", "type": "text", "label": "open questions"}]$w$::jsonb WHERE id = '249da778-ee33-4eae-a98f-510467807c72' AND md5(output_fields::text) = '9b7eef666ae48aecc6c61fd11e100ff4';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "title_options", "type": "text", "label": "Title options"}, {"key": "strengths", "type": "text", "label": "strengths"}, {"key": "guest_needs", "type": "text", "label": "guest needs"}, {"key": "draft_description", "type": "text", "label": "draft description"}]$w$::jsonb WHERE id = '8c929053-0b0e-4d3e-9cfe-21571c86ddfc' AND md5(output_fields::text) = '3b0c0345436bc773f3b5feca2e73f6e6';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "item", "type": "text", "label": "Item"}, {"key": "recommendation", "type": "text", "label": "recommendation"}, {"key": "cost_estimate", "type": "money_text", "label": "cost estimate"}]$w$::jsonb WHERE id = '4cc462d9-3f52-4aac-bd67-52ecd2e9dff7' AND md5(output_fields::text) = '68e20ff942e2716cab302d95f5c25a39';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "photo_order", "type": "text", "label": "Photo order"}, {"key": "caption_per_photo", "type": "text", "label": "caption per photo"}]$w$::jsonb WHERE id = 'b34d0b01-28f7-48cf-a051-1f965729d594' AND md5(output_fields::text) = 'a883cc9e28a96e5016441554c3b61c15';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "comparable_address_link", "type": "text", "label": "Comparable address/link"}, {"key": "nightly_or_monthly_rate", "type": "money_text", "label": "nightly or monthly rate"}, {"key": "features", "type": "text", "label": "features"}, {"key": "notes", "type": "text", "label": "notes"}]$w$::jsonb WHERE id = 'c924f690-4569-4ce1-8f17-757e8ef71210' AND md5(output_fields::text) = 'd8546fbc6eaa53a4e6b1363d4c180619';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "segment", "type": "text", "label": "Segment"}, {"key": "reason_for_travel", "type": "text", "label": "reason for travel"}, {"key": "length_of_stay", "type": "text", "label": "length of stay"}, {"key": "needs", "type": "text", "label": "needs"}]$w$::jsonb WHERE id = '98dbc9bd-5976-4736-8991-b9cdcd24fe10' AND md5(output_fields::text) = 'd783376f8e136a09bc400f5970b30ed1';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "place", "type": "text", "label": "Place"}, {"key": "category", "type": "text", "label": "category"}, {"key": "distance", "type": "text", "label": "distance"}, {"key": "note", "type": "text", "label": "note"}, {"key": "seasonal_event", "type": "text", "label": "seasonal event"}, {"key": "month", "type": "text", "label": "month"}]$w$::jsonb WHERE id = '5ee587b9-414d-4f06-9bce-a6f6560689e8' AND md5(output_fields::text) = '8914f0d2c9fd4c3ce904955eb3f8e9b6';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "channel", "type": "text", "label": "Channel"}, {"key": "audience", "type": "text", "label": "audience"}, {"key": "message", "type": "text", "label": "message"}, {"key": "timing", "type": "text", "label": "timing"}]$w$::jsonb WHERE id = 'eac4409c-e9d2-4eb7-bcca-64ec2a5dc042' AND md5(output_fields::text) = '0181c40e2d2ce46feb73cd6e1146ba01';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "post_text", "type": "text", "label": "Post text"}, {"key": "photo_choice", "type": "text", "label": "photo choice"}, {"key": "date", "type": "date", "label": "date"}]$w$::jsonb WHERE id = '386b83ea-6a4e-47f4-9a81-5b9bdcde3cfb' AND md5(output_fields::text) = '379cbc233997ad39175fb81be64547bb';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "post_text", "type": "text", "label": "Post text"}, {"key": "photo_choice", "type": "text", "label": "photo choice"}, {"key": "date", "type": "date", "label": "date"}]$w$::jsonb WHERE id = '37d8e88f-ec5e-4a62-a032-8bc5a4201fea' AND md5(output_fields::text) = '379cbc233997ad39175fb81be64547bb';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "audience", "type": "text", "label": "Audience"}, {"key": "channel", "type": "text", "label": "channel"}, {"key": "message", "type": "text", "label": "message"}]$w$::jsonb WHERE id = '7b98a961-775e-431d-802c-09628ddc369b' AND md5(output_fields::text) = 'de06d4a33ace6a41bae805143036f5b6';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "contact_type", "type": "text", "label": "Contact type"}, {"key": "organization", "type": "text", "label": "organization"}, {"key": "city", "type": "text", "label": "city"}, {"key": "relationship", "type": "text", "label": "relationship"}, {"key": "notes_no_personal_data_beyond_business_contact", "type": "text", "label": "notes (no personal data beyond business contact)"}]$w$::jsonb WHERE id = '12eb6a81-fbf9-4fcb-8068-51d171130b1a' AND md5(output_fields::text) = '687ca4348b4b3485941889d44af443ca';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "organization", "type": "text", "label": "Organization"}, {"key": "type", "type": "text", "label": "type"}, {"key": "city", "type": "text", "label": "city"}, {"key": "housing_need", "type": "text", "label": "housing need"}, {"key": "public_contact_route", "type": "text", "label": "public contact route"}, {"key": "notes", "type": "text", "label": "notes"}]$w$::jsonb WHERE id = '41e29670-5c3c-47df-aa15-288c26450ded' AND md5(output_fields::text) = 'e543d5c8390e528fe521012b6ed463a4';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "organization", "type": "text", "label": "Organization"}, {"key": "category", "type": "text", "label": "category"}, {"key": "city", "type": "text", "label": "city"}, {"key": "fit", "type": "text", "label": "fit"}, {"key": "notes", "type": "text", "label": "notes"}]$w$::jsonb WHERE id = 'ecaaf737-125c-4d23-b2f5-834f385645b9' AND md5(output_fields::text) = '3c73e632a25c002ee04228573212ef6f';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "question", "type": "text", "label": "Question"}, {"key": "answer", "type": "text", "label": "answer"}, {"key": "source", "type": "text", "label": "source"}]$w$::jsonb WHERE id = 'b5c75c6a-f0c5-4e85-898d-3d897bc840d6' AND md5(output_fields::text) = 'fa385d2a01a50f2e6b705e5242a6cd14';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "date", "type": "date", "label": "Date"}, {"key": "channel", "type": "text", "label": "channel"}, {"key": "topic", "type": "text", "label": "topic"}, {"key": "asset", "type": "text", "label": "asset"}]$w$::jsonb WHERE id = 'dcbc0596-4dc7-42e5-95e3-848bf076bd83' AND md5(output_fields::text) = '07e8baf1c7156a17de0bf127e0bebc40';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "step", "type": "text", "label": "Step"}, {"key": "observation", "type": "text", "label": "observation"}, {"key": "suggested_improvement", "type": "text", "label": "suggested improvement"}, {"key": "priority", "type": "text", "label": "priority"}]$w$::jsonb WHERE id = 'f6379ee4-1670-4635-b489-daf850c53245' AND md5(output_fields::text) = '0976c5ecb158b49f395318355ae5732f';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "style", "type": "text", "label": "Style"}, {"key": "colors_to_avoid", "type": "text", "label": "colors to avoid"}, {"key": "must_keep_items", "type": "text", "label": "must-keep items"}, {"key": "notes", "type": "text", "label": "notes"}]$w$::jsonb WHERE id = '0ade4e8b-5341-4092-af64-75a2c8e46db0' AND md5(output_fields::text) = '4bf701271d0f7eeb1a46110954e9a6d1';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "approve_or_comment", "type": "text", "label": "Approve or comment"}, {"key": "notes", "type": "text", "label": "notes"}]$w$::jsonb WHERE id = '890a7893-bb00-4f0d-8e48-1464494bd3d5' AND md5(output_fields::text) = '1ca29f90da4bfbb7c1513d20883892be';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "approve_or_comment", "type": "text", "label": "Approve or comment"}, {"key": "notes", "type": "text", "label": "notes"}]$w$::jsonb WHERE id = '60f4a24c-0dda-4f7c-bc74-cab9bab3b362' AND md5(output_fields::text) = '1ca29f90da4bfbb7c1513d20883892be';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "decision", "type": "text", "label": "Decision"}, {"key": "notes", "type": "text", "label": "notes"}]$w$::jsonb WHERE id = '22eaf430-d37f-4e57-bde5-14dcb6639ad9' AND md5(output_fields::text) = '7f9b86ce067d0a7aabbd7b49c582c679';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "item", "type": "text", "label": "Item"}, {"key": "decision", "type": "text", "label": "decision"}, {"key": "question", "type": "text", "label": "question"}]$w$::jsonb WHERE id = 'a5857f9e-21fa-4ec6-a7cc-74ba2093011f' AND md5(output_fields::text) = '60c52d7efe87932468fa68a3c95c770e';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "invoice", "type": "text", "label": "Invoice"}, {"key": "status", "type": "text", "label": "status"}, {"key": "question", "type": "text", "label": "question"}]$w$::jsonb WHERE id = 'ff23c99c-0291-4b24-b592-15a907353b43' AND md5(output_fields::text) = 'd0952c138fc4240b9f31c0f639e7b4c5';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "signed_date", "type": "date", "label": "Signed date"}, {"key": "questions", "type": "text", "label": "questions"}]$w$::jsonb WHERE id = '57fa232c-f0a8-4718-967e-e65de509b2b9' AND md5(output_fields::text) = '2e35f61a6e1be6df35fb368878bc8a1f';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "document_type", "type": "text", "label": "Document type"}, {"key": "date", "type": "date", "label": "date"}, {"key": "notes", "type": "text", "label": "notes"}]$w$::jsonb WHERE id = '840a61e5-2aad-44cb-b90c-92c758417dc9' AND md5(output_fields::text) = 'cf21260e1056d01df3016aacefd567be';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "decisions", "type": "text", "label": "Decisions"}, {"key": "questions", "type": "text", "label": "questions"}, {"key": "next_steps", "type": "text", "label": "next steps"}]$w$::jsonb WHERE id = '079d3b8a-fd75-40a5-bdd9-b64af66d36e5' AND md5(output_fields::text) = '1db5240cd605c500e1bc0e972f5854de';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "line_item", "type": "text", "label": "Line item"}, {"key": "question", "type": "text", "label": "question"}]$w$::jsonb WHERE id = '29b71e76-6f94-4fc8-bb13-d93d4439d1e3' AND md5(output_fields::text) = '62043ba781c9b6370e4f29606bb29a01';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "takeaways", "type": "text", "label": "Takeaways"}, {"key": "questions", "type": "text", "label": "questions"}]$w$::jsonb WHERE id = 'e2af3ef9-cf44-4592-b6c8-52ea1ac63ec3' AND md5(output_fields::text) = '231fccfab99ccd6bf85c71aa68e7b464';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "takeaways", "type": "text", "label": "Takeaways"}, {"key": "questions", "type": "text", "label": "questions"}]$w$::jsonb WHERE id = '6d085eb0-2992-45d0-b419-23ab6c130abc' AND md5(output_fields::text) = '231fccfab99ccd6bf85c71aa68e7b464';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "report", "type": "text", "label": "Report"}, {"key": "observation", "type": "text", "label": "observation"}, {"key": "question", "type": "text", "label": "question"}]$w$::jsonb WHERE id = 'd7874de5-aa9f-491d-a571-3978fa986802' AND md5(output_fields::text) = '21c0e2aa37d06a312b25c3dc8eaa8049';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "decision", "type": "text", "label": "Decision"}, {"key": "notes", "type": "text", "label": "notes"}]$w$::jsonb WHERE id = '92e7e21c-3b22-4c55-b344-804d57159cfc' AND md5(output_fields::text) = '7f9b86ce067d0a7aabbd7b49c582c679';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "decision", "type": "text", "label": "Decision"}, {"key": "notes", "type": "text", "label": "notes"}]$w$::jsonb WHERE id = '34f36664-d008-4fc8-b4a1-463e846e6cfa' AND md5(output_fields::text) = '7f9b86ce067d0a7aabbd7b49c582c679';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "statement_month", "type": "text", "label": "Statement month"}, {"key": "question", "type": "text", "label": "question"}]$w$::jsonb WHERE id = '70840bd0-27c7-4ad4-9627-a2e7453cb1c8' AND md5(output_fields::text) = '39727fda50ca90304be34d7c06cfec2b';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "decision", "type": "text", "label": "Decision"}, {"key": "notes", "type": "text", "label": "notes"}]$w$::jsonb WHERE id = 'ca06037a-5fc5-420c-805d-4cec90030a7f' AND md5(output_fields::text) = '7f9b86ce067d0a7aabbd7b49c582c679';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "form", "type": "text", "label": "Form"}, {"key": "submitted_date", "type": "date", "label": "submitted date"}]$w$::jsonb WHERE id = 'e8e8bdab-6ce0-4deb-8069-03c3cc74bf4d' AND md5(output_fields::text) = '0dba2ed1f9b91185a1f2605e7bd41ec1';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "provider", "type": "text", "label": "Provider"}, {"key": "date", "type": "date", "label": "date"}, {"key": "notes", "type": "text", "label": "notes"}]$w$::jsonb WHERE id = 'd9594872-8ddb-488f-bc46-3db02a65f3e8' AND md5(output_fields::text) = 'ad40fca0ad2987681e04654ae6e76115';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "appliance", "type": "text", "label": "Appliance"}, {"key": "brand", "type": "text", "label": "brand"}, {"key": "model", "type": "text", "label": "model"}, {"key": "serial", "type": "text", "label": "serial"}, {"key": "warranty_end", "type": "text", "label": "warranty end"}, {"key": "registered_yes_no", "type": "yes_no", "label": "registered (yes/no)"}]$w$::jsonb WHERE id = 'fb6da72b-3e27-48be-b79e-b5206316b376' AND md5(output_fields::text) = '9b465f827297b21306fe3a608bd057f9';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "carrier", "type": "text", "label": "Carrier"}, {"key": "coverage_type", "type": "text", "label": "coverage type"}, {"key": "premium", "type": "money_text", "label": "premium"}, {"key": "rental_coverage_notes", "type": "text", "label": "rental coverage notes"}]$w$::jsonb WHERE id = '79a351bf-d2b2-4cda-a276-51b24ab33379' AND md5(output_fields::text) = 'fa21e4fe5f2616d42875a0bb0ee95770';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "improvement", "type": "text", "label": "Improvement"}, {"key": "provider", "type": "text", "label": "provider"}, {"key": "quote", "type": "money_text", "label": "quote"}, {"key": "timeline", "type": "text", "label": "timeline"}, {"key": "recommendation", "type": "text", "label": "recommendation"}]$w$::jsonb WHERE id = '4897091e-b6d8-4c6c-9f01-997aa720a53b' AND md5(output_fields::text) = 'fda6a6d5e9bf67df730602c15e7e552d';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "agency", "type": "text", "label": "Agency"}, {"key": "city", "type": "text", "label": "city"}, {"key": "specialty", "type": "text", "label": "specialty"}, {"key": "housing_need", "type": "text", "label": "housing need"}, {"key": "public_contact_route", "type": "text", "label": "public contact route"}]$w$::jsonb WHERE id = 'c60c21cf-05ab-4d0d-a15f-8f7a680d7034' AND md5(output_fields::text) = '994d8e3187c2062400f089b631bf1fdb';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "company", "type": "text", "label": "Company"}, {"key": "city", "type": "text", "label": "city"}, {"key": "employees", "type": "number", "label": "employees"}, {"key": "relocation_program", "type": "text", "label": "relocation program"}, {"key": "public_contact_route", "type": "text", "label": "public contact route"}]$w$::jsonb WHERE id = 'f5e19c5b-aeef-408d-9e8d-9c2664d32f1e' AND md5(output_fields::text) = 'ed5713c8e193c1a241124f2f0acfdacd';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "company", "type": "text", "label": "Company"}, {"key": "type", "type": "text", "label": "type"}, {"key": "region", "type": "text", "label": "region"}, {"key": "public_contact_route", "type": "text", "label": "public contact route"}]$w$::jsonb WHERE id = '6bdf182a-f6e0-4a04-a02e-471e7a53a645' AND md5(output_fields::text) = '1a818b24543b023262870262b4b8d153';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "institution", "type": "text", "label": "Institution"}, {"key": "program", "type": "text", "label": "program"}, {"key": "city", "type": "text", "label": "city"}, {"key": "typical_stay_length", "type": "text", "label": "typical stay length"}, {"key": "public_contact_route", "type": "text", "label": "public contact route"}]$w$::jsonb WHERE id = '9e1b2671-ab4b-4a07-9b12-abc5ec71991d' AND md5(output_fields::text) = '5e6135b963d27365e171fcae7279db09';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "listing_link", "type": "text", "label": "Listing link"}, {"key": "week", "type": "text", "label": "week"}, {"key": "nightly_or_monthly_rate", "type": "money_text", "label": "nightly or monthly rate"}, {"key": "booked_dates", "type": "date", "label": "booked dates"}]$w$::jsonb WHERE id = '3922485c-b300-4e5d-9653-161573f3b269' AND md5(output_fields::text) = '102e30cac120498d1e05d63fc4a20c1d';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "feedback_theme", "type": "text", "label": "Feedback theme"}, {"key": "improvement", "type": "text", "label": "improvement"}, {"key": "reason", "type": "text", "label": "reason"}]$w$::jsonb WHERE id = 'ccedfc73-a7aa-4718-9e51-67d2ac00b2b1' AND md5(output_fields::text) = '465e873795fd7268ffde28c701d88100';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "option", "type": "text", "label": "Option"}, {"key": "requirement", "type": "text", "label": "requirement"}, {"key": "cost_estimate", "type": "money_text", "label": "cost estimate"}, {"key": "recommendation", "type": "text", "label": "recommendation"}]$w$::jsonb WHERE id = '81be3131-6098-4e5a-98c7-ffb11eaa76ae' AND md5(output_fields::text) = '476629ef9be68f49cb59744b740cda48';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "platform", "type": "text", "label": "Platform"}, {"key": "fees", "type": "money_text", "label": "fees"}, {"key": "typical_guest", "type": "text", "label": "typical guest"}, {"key": "stay_length", "type": "text", "label": "stay length"}, {"key": "fit_for_this_home", "type": "text", "label": "fit for this home"}, {"key": "notes", "type": "text", "label": "notes"}]$w$::jsonb WHERE id = 'cbc1e436-ee02-4ec0-8e0a-af4d46d148cb' AND md5(output_fields::text) = '3496f2bad14f496e04c10adb5051ffd1';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "item", "type": "text", "label": "Item"}, {"key": "frequency", "type": "text", "label": "frequency"}, {"key": "month", "type": "text", "label": "month"}, {"key": "provider_type", "type": "text", "label": "provider type"}, {"key": "notes", "type": "text", "label": "notes"}]$w$::jsonb WHERE id = '8d8c6526-a8f1-41c8-8dd3-634fa371b3e9' AND md5(output_fields::text) = '818a80e553592eed976f04745d08e098';
UPDATE public.ao_library_cards SET output_fields = $w$[{"key": "topic", "type": "text", "label": "Topic"}, {"key": "source", "type": "text", "label": "source"}, {"key": "finding", "type": "text", "label": "finding"}, {"key": "commute_destination", "type": "text", "label": "commute destination"}, {"key": "drive_time", "type": "text", "label": "drive time"}]$w$::jsonb WHERE id = 'cca1bf93-dd98-48f6-a04a-ba2ce9d25b8c' AND md5(output_fields::text) = '883decd48bff07edebaaef9044556712';
COMMIT;
