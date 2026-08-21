
DO $$
DECLARE pb uuid;
BEGIN

INSERT INTO public.playbooks (title, category, summary)
VALUES ('Arrival quality failure (clean not ready / home not guest-ready)','cleaning','Guest arrives to unmade beds, wet linens, trash out, bugs or an unlocked door. Inspect and photograph before promising anything.')
RETURNING id INTO pb;
INSERT INTO public.playbook_steps (playbook_id, position, instruction, detail, required, photo_required) VALUES
(pb,1,'Confirm the address, the guest name and exactly what they found','List every item separately: bedding, linens, trash, pests, security, damage.',true,false),
(pb,2,'Call the guest — do not only message','Apologize by phone for an arrival failure. Give what we know and a time for the next update.',true,false),
(pb,3,'Send a cleaner or coordinator to inspect and photograph every reported item',NULL,true,true),
(pb,4,'Check every exterior door and lock while on site','Unlocked doors on arrival are a safety issue, not a cleaning issue.',true,false),
(pb,5,'Fix what can be fixed today; block the calendar if the home cannot be made ready',NULL,true,false),
(pb,6,'Log deep clean, carpet/upholstery, pet treatment and deodorizing as separate line items',NULL,false,false),
(pb,7,'Decide compensation with leadership after the inspection, never before','Never promise a refund before we have photos.',true,false),
(pb,8,'Confirm with the guest in writing that the home is now correct',NULL,true,false);

INSERT INTO public.playbooks (title, category, summary)
VALUES ('Vendor dispatch and quote approval','vendor','How we brief, price, approve and verify any vendor or handyman visit.')
RETURNING id INTO pb;
INSERT INTO public.playbook_steps (playbook_id, position, instruction, detail, required, photo_required) VALUES
(pb,1,'Check the property record for an owner-preferred vendor before choosing one',NULL,true,false),
(pb,2,'Get the service/diagnostic fee and the likely repair range in writing before dispatch','Example: $X service call, $Y–$Z if it is the part they expect.',true,false),
(pb,3,'Get leadership approval for anything beyond a routine service call, or that blocks the calendar',NULL,true,false),
(pb,4,'Write the brief: address, access code, what to check, what NOT to do, photos required, who to call if scope grows',NULL,true,false),
(pb,5,'Coordinate access with the guest and give an arrival window in writing',NULL,true,false),
(pb,6,'If urgent and the vendor has not responded in the window, call the next vendor and log both attempts','Urgent means call, not message.',true,false),
(pb,7,'Confirm the tech actually arrived — require an on-site photo and a written finding',NULL,true,true),
(pb,8,'Capture cause, how long it has been that way, and how we prevent it recurring','Leadership asks these three every time.',true,false),
(pb,9,'Collect the invoice, note the payment method, and confirm nothing was double-scoped',NULL,true,false);

INSERT INTO public.playbooks (title, category, summary)
VALUES ('No hot water / water heater failure','plumbing','Same-day for any occupied home. Water heaters are also our most common hidden CO source.')
RETURNING id INTO pb;
INSERT INTO public.playbook_steps (playbook_id, position, instruction, detail, required, photo_required) VALUES
(pb,1,'Ask whether any alarm is sounding in the home','A chirp or alarm with no obvious source near a water heater is treated as a possible CO event: guests to fresh air, call 911 first.',true,false),
(pb,2,'Confirm gas or electric, and the location of the unit and its shutoff',NULL,true,false),
(pb,3,'Try the reset and the breaker/pilot before dispatching','Several of our calls were resolved by a reset.',false,false),
(pb,4,'Photograph the unit, the model plate and any leaking or scorching',NULL,true,true),
(pb,5,'Dispatch the right trade with the gas/electric detail in the brief',NULL,true,false),
(pb,6,'Get the diagnosis in writing: part, cost, availability, repair vs replacement',NULL,true,false),
(pb,7,'Update the guest with what happens next and when — before they ask',NULL,true,false),
(pb,8,'Send the owner an end-of-day update with the step-by-step',NULL,true,false),
(pb,9,'Confirm hot water with the guest before closing',NULL,true,false);

INSERT INTO public.playbooks (title, category, summary)
VALUES ('Guest compensation and claims decision','claims','Our precedent for refunds, gift baskets and damage claims so decisions stay consistent.')
RETURNING id INTO pb;
INSERT INTO public.playbook_steps (playbook_id, position, instruction, detail, required, photo_required) VALUES
(pb,1,'Write down the impact: what the guest lost, for how many days, and the nightly rate',NULL,true,false),
(pb,2,'Gather photos and vendor findings before any number is discussed',NULL,true,true),
(pb,3,'Apply the precedent: about 30% of the nightly rate per impacted day for loss of use',NULL,true,false),
(pb,4,'Safety event on arrival or overnight: up to 50% of the first night, plus a phone call and a gift basket',NULL,true,false),
(pb,5,'Anything larger than the precedent goes to leadership before it is offered',NULL,true,false),
(pb,6,'If the guest caused damage or extra cleaning, itemize costs and open the claim the same day',NULL,true,true),
(pb,7,'Deliver the decision by phone for anything significant, then confirm in writing','Never blame a vendor or a cleaner to the guest.',true,false),
(pb,8,'Record the final amount and reason on the ticket for the owner statement',NULL,true,false);

INSERT INTO public.playbooks (title, category, summary)
VALUES ('Alarm panel or access code failure','access','Panel armed, unknown code, keypad or lock not accepting the code.')
RETURNING id INTO pb;
INSERT INTO public.playbook_steps (playbook_id, position, instruction, detail, required, photo_required) VALUES
(pb,1,'Confirm the exact address and which device: alarm panel, smart lock, keypad, garage or gate',NULL,true,false),
(pb,2,'Ask the guest for a photo of the panel or lock screen',NULL,true,true),
(pb,3,'Try the codes saved on the property record, then our known house codes',NULL,true,false),
(pb,4,'If the panel is armed, walk the guest through disarming before anyone opens a door',NULL,true,false),
(pb,5,'Call an alarm company for a new code — it does not have to be the original installer',NULL,false,false),
(pb,6,'For a failed smart lock, verify wifi/battery, then dispatch a handyman to rekey and supply a new code',NULL,false,false),
(pb,7,'Save the new code to the property record and test it',NULL,true,false),
(pb,8,'Confirm the spare key is back in the lockbox',NULL,true,true),
(pb,9,'Confirm entry with the guest before closing',NULL,true,false);

INSERT INTO public.playbooks (title, category, summary)
VALUES ('Post-leak water damage and mold follow-up','plumbing','Opened after the water is stopped. A stopped leak is not a finished job.')
RETURNING id INTO pb;
INSERT INTO public.playbook_steps (playbook_id, position, instruction, detail, required, photo_required) VALUES
(pb,1,'Confirm in writing from the vendor that there is no active leaking',NULL,true,false),
(pb,2,'Inspect and photograph below, behind and above the leak: ceiling, subfloor, cabinets, drywall',NULL,true,true),
(pb,3,'Check the source chain: supply lines, appliance hoses, water heater, meter and exterior spigot','Leaks at the meter are the city''s repair — call them.',true,false),
(pb,4,'Get quotes for drying, mold treatment, drywall, flooring and any furniture affected',NULL,true,false),
(pb,5,'Decide with leadership whether the home needs a calendar block, and for how long',NULL,true,false),
(pb,6,'Move the guest or arrange compensation if the home is not fully usable',NULL,false,false),
(pb,7,'Email the owner the full step-by-step, cause and prevention plan',NULL,true,false),
(pb,8,'Re-inspect and photograph after repairs before the home goes back on the market',NULL,true,true);

END $$;
