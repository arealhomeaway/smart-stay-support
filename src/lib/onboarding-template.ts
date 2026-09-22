/**
 * ARHA "Full Furnishing" onboarding template (browser-safe).
 *
 * Source of truth: the ARHA onboarding project plan (9211 Fitzgerald Dr,
 * project 1217419174626397 — 150 tasks across 7 phases) plus the Breezeway
 * workflow export, which supplies the New House Setup work-order template IDs
 * referenced by the "create work order" tasks. Nothing here is inferred:
 * titles, phases, roles, instructions and subtasks are copied from the export,
 * duplicates are removed, and a schedule anchor/offset is attached ONLY where
 * the source instructions state the timing in writing (for example "within 10
 * calendar days of closing").
 *
 * This file is data only. Applying it is an explicit, deduplicated action —
 * see applyOnboardingTemplate in onboarding-template.server.ts.
 */

import { masterStageForLegacyTask } from "./onboarding-stage-map";
import {
  MASTER_SEQUENCE_RULES,
  MASTER_STEPS,
  onboardingRole,
  type MasterStep,
} from "./onboarding-master-sequence";

export const TEMPLATE_ROLES = [
  "Onboarding Manager",
  "Project Manager",
  "Onboarding Admin",
  "Utilities Coordinator",
  "Lead Designer",
] as const;

export type TemplateRole = (typeof TEMPLATE_ROLES)[number];

export type TemplateTask = {
  key: string;
  stage: string;
  title: string;
  role: string;
  detail?: string;
  blocksHandoff: boolean;
  requiresOwnerApproval?: boolean;
  /**
   * Owner approval only for homes enrolled in the 90-Day Owner Participation
   * Program. A regular owner completes the step with evidence of sending.
   */
  ownerApprovalWhenActiveOwner?: boolean;
  evidenceRequired?: boolean;
  /** Only present when the source instructions document the timing. */
  anchor?: "planned_closing" | "actual_closing" | "actual_access";
  offsetDays?: number;
  /** Breezeway "New House Setup" template that fulfils this work order. */
  breezewayTemplateId?: string;
  subtasks?: string[];
  /** Free-form step tags. "active_owner" marks work the homeowner does. */
  tags?: string[];
  sortOrder: number;
  /** The phase this task lived under before the 8-stage sequence. */
  legacyStage?: string;
};

export const FULL_FURNISHING_TEMPLATE: TemplateTask[] = [
  {
    key: "post_contract_send_warm_transfer_to_pm_email_pdf",
    stage: "post_contract",
    title: "Send Warm Transfer to PM Email & PDF",
    role: "Onboarding Manager",
    detail:
      "https://arealhomeaway-my.sharepoint.com/:w:/p/info/EfWp_ZFD_51Hi_DPbL-zl90BTiPSv4q9udSRbUqc9Ye03w?e=0LKkjC",
    blocksHandoff: true,
    sortOrder: 10,
  },
  {
    key: "post_contract_confirm_hoa_covenant_documents_are_stored_in_a",
    stage: "post_contract",
    title: "Confirm HOA covenant documents are stored in ARHA OneDrive",
    role: "Onboarding Manager",
    detail:
      "Instructions:\n Obtain the HOA covenants from the realtor & confirm version is up to date.\n Review the covenants to confirm there are no restrictions against short-term property rentals. (If there are restrictions, notify the realtor immediately.)\n Save these to the ARHA OneDrive account under the https://arealhomeaway-my.sharepoint.com/:f:/p/info/EuiokdYkJlBMqQ6pudgd1hIBp6BhNQYyo3U928aezFWW8Q?e=9ZrTkA.",
    blocksHandoff: true,
    sortOrder: 20,
  },
  {
    key: "post_contract_obtain_inspection_date_time_from_realtor_and_u",
    stage: "post_contract",
    title: "Obtain assessment date/time from realtor and update project plan",
    role: "Project Manager",
    detail:
      "Instructions:\n Consult the Telegram thread for the inspection date and time. Alternatively, if this has not been scheduled, please schedule this in coordination with the Realtor and handyman.\n On the Project Plan, update the due date for the INSPECTION DATE milestone.\n Document the time of the inspection in the comment section of the milestone.",
    blocksHandoff: true,
    sortOrder: 30,
  },
  {
    key: "post_contract_verify_the_property_mailing_address_at_us_post",
    stage: "post_contract",
    title: "Verify the property mailing address at US Postal Service website",
    role: "Project Manager",
    detail:
      'Instructions:\n1.) Perform a zip code lookup by address at the US Postal Service website. https://tools.usps.com/zip-code-lookup.htm?byaddress\n\n2.) Enter the full property address and click "Find." The site will return the official mailing address.\n\n3.) Record the official USPS mailing address on the project overview in Resolve.',
    blocksHandoff: true,
    sortOrder: 40,
  },
  {
    key: "post_contract_update_breezeway_details_finalize_setup_on_act",
    stage: "post_contract",
    title: 'Update Breezeway "Details" & Finalize Setup on Active Page',
    role: "Onboarding Admin",
    detail:
      'Instructions:\n Please update the Details tab within the property in Breezeway.\n On the left sidebar in Breezeway, click Properties.\n Locate the property within the list on the left side of the page and click the property address.\n Select Profile from the left-hand sidebar.\n From there, please click the Details tab under the address shown on the center of the screen.\n Update the following information: \n Square Footage (Can be obtained from Zillow. This is a great resource for our cleaners to have.)\n Property Group = City in which the house is located \n Property Tags \n # of Bedrooms\n # of Bathrooms\n Cleaner Group (DFW, Tulsa or OKC)\n Select the tag "New House - Currently Inactive". (This tag will be removed once lawn maintenance is scheduled at the end of the onboarding process.)',
    blocksHandoff: true,
    sortOrder: 50,
  },
  {
    key: "post_contract_create_work_order_for_vendor_to_attend_inspect",
    stage: "post_contract",
    title:
      "Create work order for Vendor to attend the assessment appointment and conduct home assessment",
    role: "Project Manager",
    detail:
      "Information: \n The Realtor, Handyman and the professional home inspector will attend this appointment. The professional home inspector will conduct his inspection, but the Realtor and the Handyman will do their own walkthroughs to assess the property for any cosmetic/safety concerns that ARHA needs to address. The Designer will be available via Telegram during this time and the Project Manager will video conference with the Realtor during the inspection to ask questions while the Realtor and Handyman are on the premises.\n\n This is the only time ARHA will be able to see the property in person prior to our buyer's purchase of the property, so this is an important appointment. We need to be able to identify any home improvements/repairs that are necessary and quickly obtain estimates for them. \n\nInstruction:\n Send a Telegram message to the property Telegram group and …",
    blocksHandoff: true,
    breezewayTemplateId: "143362",
    sortOrder: 60,
  },
  {
    key: "post_contract_create_a_work_order_for_vendor_to_measure_for_",
    stage: "post_contract",
    title: "Create a work order for Vendor to measure for custom blinds (if applicable)",
    role: "Project Manager",
    detail:
      "Instructions:\n Please schedule a work order using the New House Setup - Measure Windows for Custom Blinds template in Breezeway.",
    blocksHandoff: false,
    breezewayTemplateId: "200966",
    sortOrder: 70,
  },
  {
    key: "post_contract_create_a_task_summary_sheet_for_the_staging_te",
    stage: "post_contract",
    title: "Create a Task Summary Sheet for the Staging Team",
    role: "Project Manager",
    detail:
      "Locate your property folder in the “New House Setup Documents” folder in the properties section of OneDrive and open the Excel file titled Task Summary Sheet. Input all estimated task dates using the projected closing date as a starting point. This schedule serves as a planning tool for the staging team and all vendors to understand when their responsibilities are expected to occur.\n Assign dates to represent different project stages progressing through the 3-week setup window.\n Ensure all dates fall Monday–Friday, 8 AM–5 PM CST. (For reference: 8 AM CST = 9 AM EST / Indiana Time).\n If the closing date is on a weekend, begin with security install on the following Monday.\n Align Wi-Fi installation with the security install day where possible.\n Stage dates should reflect furniture delivery as day one and span 4–5 business days.\n Final clean, trash disposal, photo prep, …",
    blocksHandoff: true,
    sortOrder: 80,
  },
  {
    key: "phase1_inspection_inspection_date",
    stage: "phase1_inspection",
    title: "ASSESSMENT DATE",
    role: "Project Manager",
    blocksHandoff: true,
    // No written rule: this milestone is a scheduled appointment set by the
    // realtor/handyman ("Obtain inspection date/time from realtor"), not a
    // deadline derived from closing. Left unset on purpose.
    sortOrder: 90,
  },
  {
    key: "phase1_inspection_send_a_real_home_away_management_agreement",
    stage: "phase1_inspection",
    title:
      "Send A Real Home Away management agreement to prospective buyer for review and signature",
    role: "Onboarding Manager",
    detail:
      "Instructions:\nUse DocuSign to forward the ARHA property management agreement to prospective buyer for review and signature.",
    blocksHandoff: true,
    requiresOwnerApproval: true,
    sortOrder: 100,
  },
  {
    key: "phase1_inspection_review_walkthrough_videos_posted_on_telegr",
    stage: "phase1_inspection",
    title: "Review walkthrough videos posted on Telegram in real time",
    role: "Project Manager",
    detail:
      "Instructions:\nDuring the inspection walkthrough, ask the Realtor to confirm any important details that you may have concerns about (from viewing the MLS photos, or from any issues the Designer may have brought up prior to the call). \n\nThe below questions are always good to ask, but you may think of additional questions:\n Does the front door have a secondary lock/deadbolt that needs to be removed to prevent guests and contractors getting locked out?\n\n Will the bathrooms need blinds/coverings installed before guests can occupy the home?\n\n Do the bathrooms have toilet holders, towel racks and shower curtain rods (if applicable)?\n\n What kind of garage door opener (brand and Wifi enabled?) does the property have? (We will need this information when we begin In-Garage Delivery from Amazon.)\n\n Does the property have a working garage keypad?\n\n For a 3-car garage, is there a …",
    blocksHandoff: true,
    evidenceRequired: true,
    subtasks: [
      "Determine if there is a lock/deadbolt that needs to be removed to prevent guests/contractors getting locked out.",
      "Determine if bathrooms needs blinds/coverings before guests can occupy the home",
    ],
    sortOrder: 110,
  },
  {
    key: "phase1_inspection_review_str_requirements_and_notify_pm_of_c",
    stage: "phase1_inspection",
    title: "Review STR Requirements and notify PM of costs",
    role: "Onboarding Admin",
    detail:
      "Instructions\n Check the provided research results (permit required Y/N and cost breakdown) on the project record in Resolve.\n If a permit is required:\n Notify the Project Manager by posting a comment using the template below.\n Remind them to also add a $100 processing costs to a separate line item to cover our internal costs.\n If a permit is not required:\n Record “No STR permit required”\n Add a comment on this task in Resolve confirming that no action is needed & tag the Project Manager.\n\nPM Notification — copy/paste template\n\n> STR permit research is complete and a permit is required. \nThe cost is $\nWe need to add the permit cost + $100 processing cost added to make-ready invoice ( $100 will need to be on a separate line item).",
    blocksHandoff: true,
    sortOrder: 120,
  },
  {
    key: "phase1_inspection_send_introduction_e_mail_to_prospective_ow",
    stage: "phase1_inspection",
    title: "Send introduction e-mail to prospective owner",
    role: "Project Manager",
    detail:
      "Instructions:\nThe Project Manager should send the below email to the prospective owner as an introduction, and provide a quick overview of the upcoming furnishing process. (Be sure to include the PDF attachment as well.) \n\nLetter template: https://arealhomeaway-my.sharepoint.com/:w:/p/info/EfnNlINxOQlLu_1Q5wMv6ckB2W2xG1fTHhd700UxyF_Y1g?e=uaIz0s\n\nE-MAIL TEXT:\n\nSubject: Welcome to A Real Home Away - Next Steps for Your New Home\n\nDear [Client's Name],\n\nWelcome to A Real Home Away! My name is [Your Name], and I am the Project Manager for your home. I will be your main point of contact throughout the repair and staging process and will be here to assist you until your property is transitioned to our Operations team for management.\nThe next steps for your property are as follows:\n\n New Home Assessment: We will be assessing your home. This assessment includes identifying …",
    blocksHandoff: true,
    sortOrder: 130,
  },
  {
    key: "phase1_inspection_request_repair_estimates_from_handyman_and",
    stage: "phase1_inspection",
    title: "Request repair estimates from handyman and other vendors (if applicable)",
    role: "Project Manager",
    detail:
      "Instructions:\n Review the completed work order from the home assessment. \n NOTE: If the assessment indicates a home alarm system is present CREATE A TASK to request realtor obtain setup instructions at close. \n\n Create a new work order in Breezeway for the handyman assigned to the project, and request repair estimates for all of the improvements/repairs identified during the ARHA home assessment. (These include the repairs recommended by the handyman and improvements/repairs recommended by the designer.) Indicate in the work order that the estimate should be broken out by job, and that it should be returned to the project manager within 24-48 hours.\n\n Notify the handyman via Telegram that you are requesting an estimate for repairs and have created a work order that is due on _________ date.\n\n If you need estimates from additional outside vendors (like a flooring or …",
    blocksHandoff: false,
    sortOrder: 140,
  },
  {
    key: "phase1_inspection_document_information_for_str_requirements",
    stage: "phase1_inspection",
    title: "Document information for STR requirements",
    role: "Project Manager",
    detail:
      "Instructions:\nBased on feedback from the STR Coordinator, document the following for future handling:\n\n If STR permit is required, include the cost in the list of repairs when creating your home improvements estimate, as the owner will need to pay for this permit along with repairs.\n\n Does the property require a 30-day minimum stay? If so, be sure to include this information in the handoff meeting with Operations.",
    blocksHandoff: true,
    sortOrder: 150,
  },
  {
    key: "phase1_inspection_follow_up_on_property_management_agreement",
    stage: "phase1_inspection",
    title: "Follow up on property management agreement (and utility agreement), if not received",
    role: "Onboarding Manager",
    blocksHandoff: true,
    sortOrder: 160,
  },
  {
    key: "phase1_inspection_set_up_internet_service_and_schedule_cox_i",
    stage: "phase1_inspection",
    title: "Set up internet service and schedule Cox install",
    role: "Utilities Coordinator",
    blocksHandoff: true,
    subtasks: ["Set up auto-pay", "Record in Resolve"],
    sortOrder: 170,
  },
  {
    key: "phase1_inspection_create_work_order_to_meet_cox_installer",
    stage: "phase1_inspection",
    title: "Create work order to meet Cox installer",
    role: "Utilities Coordinator",
    detail:
      "Instructions:\n Please create a work order for a handyman to meet the cable installer. Use the Breezeway template: New House Setup - Meet Cox Installer. \n Please add the project manager's email address to the first line of the work order. \n\nThe below text is included in the Breezeway template \n\nPROJECT MANAGER EMAIL: \n\nPlease be at the house to meet the Cox installer. If given a choice, please have modem placed in an inconspicuous location at the property. Below are the requested locations, in order of preference:\n\n1.) Hall/entry/master closet\n2.) Secondary bedroom on the dresser \n3.) Livingroom mantle\n\nPlease notify the project manager if a line is run outside and not yet buried. \n\nThank you!",
    blocksHandoff: true,
    breezewayTemplateId: "134120",
    subtasks: ["Split Wi-Fi into Two Networks & Update Name/Password"],
    sortOrder: 180,
  },
  {
    key: "phase1_inspection_transfer_set_up_electric_service",
    stage: "phase1_inspection",
    title: "Transfer/set up electric service",
    role: "Utilities Coordinator",
    blocksHandoff: true,
    subtasks: ["Set up auto-pay", "Record in Resolve"],
    sortOrder: 190,
  },
  {
    key: "phase1_inspection_transfer_set_up_gas_service",
    stage: "phase1_inspection",
    title: "Transfer/ set up gas service",
    role: "Utilities Coordinator",
    detail:
      "Based on project manager feedback, either have this billed to owner or ARHA\n\nTEMPLATE - \nService starts: \n $35 connection fee on first bill\n auto pay and e-billing set up\n need to add the account to our online account\n acct #:",
    blocksHandoff: true,
    subtasks: ["Set up auto-pay", "Record in Resolve"],
    sortOrder: 200,
  },
  {
    key: "phase1_inspection_transfer_set_up_water_sewer_service",
    stage: "phase1_inspection",
    title: "Transfer/set up water/sewer service",
    role: "Utilities Coordinator",
    blocksHandoff: true,
    subtasks: ["Set up auto-pay", "Record in Resolve"],
    sortOrder: 210,
  },
  {
    key: "phase1_inspection_transfer_trash_service",
    stage: "phase1_inspection",
    title: "Transfer trash service",
    role: "Utilities Coordinator",
    blocksHandoff: true,
    subtasks: [
      "Set up Autopay",
      "Add Trash Info to the Important Trash Details Page",
      "Add trash info to Breezeway",
      "Record in Resolve",
    ],
    sortOrder: 220,
  },
  {
    key: "phase1_inspection_follow_up_on_str_permit_information",
    stage: "phase1_inspection",
    title: "Follow-up on STR permit information",
    role: "Project Manager",
    detail:
      "Instructions:\n\nReview information on STR Permit\n\n If you have not rcvd a response from the Short Term Rental Coordinator yet, please follow-up\n If no STR permit is required, close the STR Permit request task in Resolve\n If so, ensure this is included in repair estimate",
    blocksHandoff: true,
    sortOrder: 230,
  },
  {
    key: "phase1_inspection_review_the_new_house_setup_form_results",
    stage: "phase1_inspection",
    title: "Review the New House Setup Form Results",
    role: "Project Manager",
    detail:
      "To view results, open the New House Setup responses on this task in Resolve.",
    blocksHandoff: true,
    evidenceRequired: true,
    sortOrder: 240,
  },
  {
    key: "phase1_inspection_save_and_review_inspection_report_and_trr",
    stage: "phase1_inspection",
    title: "Save assessment report and TRR to the property file (save only \u2014 no review)",
    role: "Project Manager",
    detail:
      "SAVE ONLY \u2014 ARHA does not review assessment reports. Save the report to the property file and stop there. Only work on bids the Realtor has explicitly requested; do not proactively review or quote assessment findings.\n\nASSESSMENT REPORT - This report is usually available 1-2 days following the home inspection and will be provided to us by the Realtor. It will contain recommendations for repairs, with each repair classed as Immediate, Moderate or Routine Maintenance. Most Immediate or Moderate maintenance issues are negotiated to be handled by the Seller before the sale of the home, and we do not need to address these. Sometimes, however, there are remaining Routine Maintenance issues that are also cosmetic/safety concerns that may affect the guest experience, so we need to include them as we consider possible home improvements for the property.\n\nTRR - This is the Treatments, Repairs and Replacements notice. It outlines which repairs from the inspection report the Seller has agreed to complete prior to sale of the property, and which repairs the Seller will not complete prior to the …",
    blocksHandoff: true,
    evidenceRequired: true,
    sortOrder: 250,
  },
  {
    key: "phase1_inspection_enter_improvement_and_repair_estimates_int",
    stage: "phase1_inspection",
    title: "Enter improvement and repair estimates into OneDrive",
    role: "Project Manager",
    detail:
      "Instructions:\n Once you receive estimates from the handyman and any additional vendors, enter each line item improvement and repair recommendation, along with the quoted cost into the Home Improvements Template located in the properties New House Setup folder. \n\n Review the project to ensure that costs for both labor and materials has been captured for each job.",
    blocksHandoff: true,
    sortOrder: 260,
  },
  {
    key: "phase1_inspection_reminder_add_str_permit_cost_to_the_one_dr",
    stage: "phase1_inspection",
    title: "Reminder: Add STR permit cost to the One Drive repair estimate",
    role: "Project Manager",
    detail:
      "Instructions:\nBe sure to include the cost of the STR permit (if applicable) on the Excel home improvement estimate within the properties folder.\n\n Reminder - Rename the document with the home address & adjust the address column on the sheet with the home address.",
    blocksHandoff: true,
    sortOrder: 270,
  },
  {
    key: "phase1_inspection_update_project_status",
    stage: "phase1_inspection",
    title: "Update project status",
    role: "Project Manager",
    detail:
      "Update the project status on this home in Resolve and note anything the team needs to be aware of.",
    blocksHandoff: false,
    sortOrder: 280,
  },
  {
    key: "phase2_estimates_enter_approved_home_improvements_estimate_i",
    stage: "phase2_estimates",
    title: "Enter approved home improvements estimate into Houzz Pro estimate template",
    role: "Project Manager",
    detail:
      "Instructions:\nCreate a client-ready estimate using Houzz Pro. The step-by-step guide is in the Resolve playbook library.",
    blocksHandoff: true,
    sortOrder: 290,
  },
  {
    key: "phase2_estimates_complete_the_repair_estimate_approval_form",
    stage: "phase2_estimates",
    title: "Complete the Repair Estimate Approval Form",
    role: "Project Manager",
    detail:
      "Instructions:\nComplete the approval request on this task in Resolve and submit it.\n\nIf it is less than 7 days from closing and you do not hear a response on this being approved, send a reminder to the Onboarding Manager.",
    blocksHandoff: true,
    subtasks: [
      "Send a reminder to the Onboarding Manager if you are waiting for Repair Estimate Approval and it has been more than 24 hours since completing the form",
    ],
    sortOrder: 300,
  },
  {
    key: "phase2_estimates_add_the_owner_as_a_client_in_houzz_pro",
    stage: "phase2_estimates",
    title: "Add the Owner as a client in Houzz Pro",
    role: "Project Manager",
    detail:
      'Create a new client in https://pro.houzz.com/ prior to sending the owner an estimate. \n\nIn Houzz Pro, go to the project > on the top bar on the center of the screen there is a link to "Add Client". Select that and fill out client information. \n\nAttaching this client allows us to have more information on when they read, sign, or respond to an estimate.',
    blocksHandoff: true,
    sortOrder: 310,
  },
  {
    key: "phase2_estimates_closing_date_verification_1_update_project_",
    stage: "phase2_estimates",
    title:
      "CLOSING DATE VERIFICATION #1: Update Project Plan & Notify Utilities Coordinator if the closing date has changed (1st reminder)",
    role: "Project Manager",
    detail:
      "Instructions:\n1.) Update the Project Plan if your Closing Date has changed.\n\n2.) Send a note to the Utilities Coordinator to notify them of the revised property closing date. They will need to keep close tabs on this date in order to set up utilities in a timely manner.",
    blocksHandoff: true,
    sortOrder: 320,
  },
  {
    key: "phase2_estimates_purchase_door_locks_curtain_rods_curtain_pa",
    stage: "phase2_estimates",
    title: "Purchase door locks, curtain rods, curtain panels, and all related accessories",
    role: "Project Manager",
    detail:
      "Instructions:\nPRE-REQUISITE: Need window covering instructions from Designer\n\nPurchase the following items from Amazon:\n Curtain rods (based on instructions from the designer found in the Design Plan)\n Curtain panels (based on specifications from designer) (Send panels to BAILEA for pressing in advance if she is staging the property, or Kim Martinez in advance if she is staging the property. For OKC properties, send the panels to the property.)\n Drywall anchors\n TV mounts\n Supply closet combination lock\n Yale front door lock/Yale module\n Lockbox for front door key\n Batteries\n Shower curtain rods\n Any additional bathroom hardware needed (towel rods/hooks, etc.)\n Ring security equipment\n Garage keypad (if needed)\n\nDelivery Instructions:\nHave all items shipped to the assigned handyman for the project. Provide a heads up that this is coming and with the list of items, …",
    blocksHandoff: true,
    sortOrder: 330,
  },
  {
    key: "phase2_estimates_forward_pma_to_the_utilities_coordinator_an",
    stage: "phase2_estimates",
    title: "Forward PMA to the Utilities Coordinator and notify of utilities election",
    role: "Onboarding Manager",
    detail:
      "Forward the Property Management Agreement to the Utilities Coordinator for this project. \n\nBe sure to include the following in your email: \n Property Address\n Closing Date, including the ideal date for internet setup\n Owners Name\n Utilities Election\n Solar Panels, if applicable",
    blocksHandoff: true,
    sortOrder: 340,
  },
  {
    key: "phase2_estimates_update_project_status",
    stage: "phase2_estimates",
    title: "Update project status",
    role: "Project Manager",
    detail:
      "Update the project status on this home in Resolve and note anything the team needs to be aware of.",
    blocksHandoff: false,
    sortOrder: 350,
  },
  {
    key: "phase2_estimates_review_approve_home_repair_estimate",
    stage: "phase2_estimates",
    title: "Review & Approve Home Repair Estimate",
    role: "Onboarding Manager",
    detail:
      "After receiving the Home Estimate Approval Form via email, carefully review the submitted repair estimate to ensure all listed items align with the original Property Assessment (PA). Compare the approved amount with the estimate submitted during onboarding.\n If the total repair estimate exceeds the PA amount by more than $500, pause approval and submit the estimate to the CEO for review and approval before proceeding.\n Document your approval or escalation status and confirm with the onboarding manager once approved.\nNote: Timely review is crucial to avoid delays in repairs and project scheduling.",
    blocksHandoff: true,
    sortOrder: 360,
  },
  {
    key: "phase3_work_orders_str_compliance_30_day_rental_restriction_",
    stage: "phase3_work_orders",
    title: "STR Compliance & 30-Day Rental Restriction Review",
    role: "Project Manager",
    detail:
      "Review whether there is an active Short-Term Rental (STR) application, registration, or approval process that would restrict the property to a 30-day minimum rental until STR approval is granted.\nIf any such restriction exists, notify the property owner immediately with details and next steps.",
    blocksHandoff: true,
    sortOrder: 370,
  },
  {
    key: "phase3_work_orders_closing_date_verification_2_update_projec",
    stage: "phase3_work_orders",
    title:
      "CLOSING DATE VERIFICATION #2: Update Project Plan & Notify Utilities Coordinator if the closing date has changed (2nd reminder)",
    role: "Project Manager",
    detail:
      "Instructions:\n1.) Update the Project Plan if your Closing Date has changed.\n\n2.) Send a note to the Utilities Coordinator to notify them of the revised property closing date. They will need to keep close tabs on this date in order to set up utilities in a timely manner.",
    blocksHandoff: true,
    sortOrder: 380,
  },
  {
    key: "phase3_work_orders_send_recommended_repair_home_improvements",
    stage: "phase3_work_orders",
    title: "Send recommended repair & home improvements cost projections to prospective buyer",
    role: "Project Manager",
    detail:
      "Instructions:\n Once approved by the Onboarding Manager, forward the home improvement estimate to prospective buyer via Houzz. CC yourself. \n\n Include additional information and justifications for any costly recommendations or any that are not self-explanatory\n\n Include a request that the prospective buyer contact us with any questions or concerns, and approve and return the estimate at their earliest convenience\n\nPlease use the email template below after sending the estimate through Houzz Pro:\n\n\"Hello [Owner's Name],\n\nWe’re pleased to share that we have finalized an estimate for the repairs, improvements, and standard updates needed for your property at [Property Address]. This estimate covers all anticipated work to prepare the home.\n\nIf you have any questions or would like clarification on any part of the estimate, please feel free to reach out. We’re more than …",
    blocksHandoff: true,
    requiresOwnerApproval: true,
    sortOrder: 390,
  },
  {
    key: "phase3_work_orders_confirm_utilities_are_scheduled_to_be_tra",
    stage: "phase3_work_orders",
    title: "Confirm utilities are scheduled to be transferred/set up at closing",
    role: "Project Manager",
    detail:
      "Instructions:\nThe project manager is responsible for ensuring utilities transfer/setup is handled in a timely manner. Contact the person handling utilities set up to confirm that water, electric and gas (if applicable) are scheduled to be transferred, and Wifi is scheduled to be set up immediately following closing.\n\nIf we are still pending receipt of the property management agreement or any information required for utilities to be set up in a timely manner, please notify the Senior Project Manager or Team Lead. Reschedule this task for one day prior to closing to recheck the status of utilities.",
    blocksHandoff: true,
    sortOrder: 400,
  },
  {
    key: "phase3_work_orders_select_essentials_list_and_modify_for_add",
    stage: "phase3_work_orders",
    title: "Select essentials list and modify for additional bathrooms",
    role: "Project Manager",
    detail:
      'Instructions:\nUse the below instructions to create a list of Essentials for your property. "Essentials" are items that ARHA provides to every property, like bathroom and kitchen supplies, bed linens, cleaning supplies, towels, etc.\n\n1.) Select the appropriate Essentials template:\n3 bedroom: https://app.smartsheet.com/sheets/WQ5hVh62PhqrpRX45WgphVFRF6p4Q86hFhH35hM1\n4 bedroom: https://app.smartsheet.com/sheets/QH78xg2wVw3qXMhxPfcHMvxg26CVGHc4HcMrRqv1\n\n2.) SAVE A COPY of the appropriate template to your property\'s folder, and RENAME IT with the name of your property. Please do this before making any modifications to the file. Do not modify the template itself.\n\nNote: If your property happens to have an additional bathroom (more than 2), you will need to adjust the quantities on the essentials list per the lists below.\n\n Additional bathrooms\n Add 1 bath trash can x # of …',
    blocksHandoff: true,
    sortOrder: 410,
  },
  {
    key: "phase3_work_orders_schedule_a_daily_runner_to_pull_deliverie",
    stage: "phase3_work_orders",
    title: "Schedule a daily runner to pull deliveries into the garage",
    role: "Project Manager",
    blocksHandoff: true,
    sortOrder: 420,
  },
  {
    key: "phase3_work_orders_create_work_orders_for_setup_but_do_not_a",
    stage: "phase3_work_orders",
    title: "CREATE WORK ORDERS FOR SETUP, BUT DO NOT ASSIGN UNTIL AFTER CLOSING",
    role: "Project Manager",
    detail:
      "Instructions:\n Begin setting up and scheduling the next series of work orders in the project plan, but DO NOT assign them to a resource until after the property sales transaction has closed.\n\n Once closing has been verified, work orders for In-Garage Delivery Setup have been assigned, and all inventory has been purchased, then these work orders for repairs/improvements, cleaning, setting out essentials, and staging can be assigned.",
    blocksHandoff: true,
    sortOrder: 430,
  },
  {
    key: "phase3_work_orders_create_work_order_to_pick_up_keys_from_po",
    stage: "phase3_work_orders",
    title: "Create work order to pick up keys from post office, if necessary",
    role: "Project Manager",
    detail:
      "Instructions:\n\n1.) Ask the Realtor if the home's mailbox is owned by the USPS. If so, find out if the keys will be available at the title company at closing or if someone needs to pick them up from the post office.\n\n2.) If needed, create a work order to have someone pick up the keys from the servicing post office following closing. They may need the following documents to show the post office:\n Packet from the title company\n Deed of sale\n Management agreement\n Their ID",
    blocksHandoff: true,
    sortOrder: 440,
  },
  {
    key: "phase3_work_orders_create_work_order_for_pre_work_inspection",
    stage: "phase3_work_orders",
    title: "Create work order for Pre-Work Inspection",
    role: "Project Manager",
    detail:
      "Instructions:\n Please create and schedule a work order in Breezeway to have the Pre-Work Inspection done at the property.\n\n Use the New House Setup - Pre-Work Inspection template in Breezeway, which contains the directions below\n\n (This template is found under the Inspection department)\n\n This should occur the same day as the lock and security package installation (Ring cameras, myQ, etc)",
    blocksHandoff: true,
    // Source rule is relative to another task ("same day as the lock and
    // security package installation"), not to closing or access. Task-relative
    // anchors are not supported, so the date is left unset.
    breezewayTemplateId: "208326",
    sortOrder: 450,
  },
  {
    key: "phase3_work_orders_create_work_order_for_standard_inspection",
    stage: "phase3_work_orders",
    title: "Create work order for Standard Inspection",
    role: "Project Manager",
    detail:
      "Instructions:\n Please create and schedule a work order in Breezeway to have the Standard Inspection done at the property.\n\n Use the New House Setup - Standard Inspection template in Breezeway, which contains the directions below\n\n (This template is found under the Inspection department)\n\n This should occur within 10 calendar days of closing on the property.",
    blocksHandoff: true,
    anchor: "actual_closing",
    offsetDays: 10,
    breezewayTemplateId: "208327",
    sortOrder: 460,
  },
  {
    key: "phase3_work_orders_create_work_order_for_final_inspection",
    stage: "phase3_work_orders",
    title: "Create work order for Final Inspection",
    role: "Project Manager",
    detail:
      "Instructions:\n Please create and schedule a work order in Breezeway to have the final inspection done at the property.\n\n Use the New House Setup - Final Inspection template in Breezeway, which contains the directions below\n\n (This template is found under the Inspection department)\n\n This should occur after property is complete, prior to handing off to Operations.",
    blocksHandoff: true,
    breezewayTemplateId: "208328",
    sortOrder: 470,
  },
  {
    key: "phase3_work_orders_create_work_order_for_installation_of_loc",
    stage: "phase3_work_orders",
    title: "Create work order for installation of locks",
    role: "Project Manager",
    blocksHandoff: true,
    breezewayTemplateId: "157686",
    sortOrder: 480,
  },
  {
    key: "phase3_work_orders_create_work_order_for_installation_of_rin",
    stage: "phase3_work_orders",
    title: "Create work order for installation of Ring doorbell",
    role: "Project Manager",
    blocksHandoff: true,
    breezewayTemplateId: "158054",
    sortOrder: 490,
  },
  {
    key: "phase3_work_orders_create_a_work_order_to_place_surveillance",
    stage: "phase3_work_orders",
    title: "Create a work order to place surveillance signs and hedge delivery box",
    role: "Project Manager",
    detail:
      'INSTRUCTIONS:\nUse the Breezeway template "New House Setup - Place surveillance signs / hedge box" to create a work order for the handyman to place these items at the home.',
    blocksHandoff: true,
    breezewayTemplateId: "185394",
    sortOrder: 500,
  },
  {
    key: "phase3_work_orders_create_work_order_to_schedule_cleaner_to_",
    stage: "phase3_work_orders",
    title: "Create work order to schedule cleaner to press curtains",
    role: "Project Manager",
    detail:
      'Instructions:\n Please create and schedule a work order in Breezeway to have the curtain panels pressed at the home.\n\n Use the New House Setup - Press Curtains template in Breezeway, which contains the directions below. \n\n Please indicate the quantities of 108-inch panels and 96-inch panels in the work order (pls see the template verbiage below). This information can be found in the window coverings instructions from the Design Plan.\n\n Please also attached to the work order a PDF of the window coverings instructions from the Design Plan so that the presser will know which curtain lengths to use on each window..\n\nINSTRUCTIONS ON BREEZEWAY TEMPLATE:\nPlease locate the following curtain panels at the home: \n\nQty: # 108" panels, # 96" panels\n\nPlease press curtains and hang them according to the instructions attached. \n\nThank you for your help!',
    blocksHandoff: true,
    breezewayTemplateId: "147792",
    sortOrder: 510,
  },
  {
    key: "phase3_work_orders_schedule_carpet_cleaning_replacement_if_n",
    stage: "phase3_work_orders",
    title: "Schedule carpet cleaning/replacement (if necessary)",
    role: "Project Manager",
    detail:
      "Reference: the Resolve vendor directory.\n\nInstructions:\n Carpet cleaning guidelines: \n Do NOT clean the carpet unless a UV light inspection has been done for the presence of pet urine. \n If good condition and clean = do nothing \n If dirty (visible stains/marks) w/ no pet urine = carpet cleaning \n If dirty w/ pet urine = replace carpet \n If worn or damaged = replace\n\n For new carpeting - We use two primary carpet installers for OKC and Tulsa area properties (both companies' contact info is in the Resolve vendor directory)\n OKC - J-Mar Carpeting - ask for the same carpet used at Lightning Creek (Ronnie is our contact - 405-820-7826)\n Tulsa - C&B Carpeting - ask for the same carpet used at 3000 W. Charlotte in Broken Arrow\n\n We utilize standard carpet product/color unless the home colors are …",
    blocksHandoff: false,
    sortOrder: 520,
  },
  {
    key: "phase3_work_orders_create_work_order_for_home_repairs_if_nec",
    stage: "phase3_work_orders",
    title: "Create work order for home repairs (if necessary)",
    role: "Project Manager",
    detail:
      "Reference: the Resolve vendor directory.\n\nInstructions:\n Please create and schedule work orders in Breezeway for any approved home repairs.\n\n We do not have templates regarding repairs, because every home requires something different. When creating a work order, please keep in mind the following:\n Be specific in your instructions to the contractor.\n Try to use bullet points to make instructions easier to read.\n Attach reference photos w/ or w/o markups whenever you think they will be helpful.\n\n As you create work orders, you may group similar jobs within work orders (like different painting tasks, or different outdoor tasks). One exception is furniture assembly tasks. Please do not group any furniture assembly tasks on work orders with any other tasks. (Furniture assembly tasks are classed …",
    blocksHandoff: false,
    sortOrder: 530,
  },
  {
    key: "phase3_work_orders_create_work_order_for_painting_if_necessa",
    stage: "phase3_work_orders",
    title: "Create work order for painting (if necessary)",
    role: "Project Manager",
    detail:
      "Instructions:\n Please create and schedule work orders in Breezeway for any approved painting.\n\n We do not have templates regarding painting, because every home requires something different. When creating a work order, please keep in mind the following:\n Be specific in your instructions to the contractor.\n Try to use bullet points to make instructions easier to read.\n Attach reference photos w/ or w/o markups whenever you think they will be helpful.\n\n As you create work orders, you may group similar jobs within work orders (like different painting tasks, or different outdoor tasks). One exception is furniture assembly tasks. Please do not group any furniture assembly tasks on work orders with any other tasks. (Furniture assembly tasks are classed differently than other jobs, and the home buyer pays us for them differently)\n\n Please ask the senior project manager if you have any questions.",
    blocksHandoff: false,
    breezewayTemplateId: "134124",
    sortOrder: 540,
  },
  {
    key: "phase3_work_orders_create_work_order_s_for_installation_of_c",
    stage: "phase3_work_orders",
    title: "Create work order(s) for installation of curtain rods",
    role: "Project Manager",
    detail:
      'Instructions:\n Please create and schedule a work order in Breezeway to have the curtain rods installed at the property.\n\n Use the New House Setup - Install Curtain Rods template in Breezeway, which contains the directions below.\n\n Please attached the grid from the window coverings instructions in the Design Plan to the work order so that handyman will know which curtain rod to install for each window. \n\nCURTAIN ROD INSTALLATION INSTRUCTIONS:\n*Utilize the drywall anchors delivered to you (or the home) for installation.\n\n*Please see the attached image for guidance on how to hang the curtain rods. (You may need to click "Download" in your browser to view it.)\n\n*Please see the attached chart for information regarding which windows will need curtain rods and which length of rod to install. If you have any questions, please contact your project manager.\n\n*Please hang the …',
    blocksHandoff: true,
    breezewayTemplateId: "134115",
    sortOrder: 550,
  },
  {
    key: "phase3_work_orders_create_work_order_to_install_carbon_monox",
    stage: "phase3_work_orders",
    title: "Create work order to install carbon monoxide detector",
    role: "Project Manager",
    detail:
      "Instructions:\n1.) Create a work order to install the carbon monoxide detector shipped to the home as part of the Essentials order.\n\n2.) Use the New House Setup - Install Carbon Monoxide Detector template in Breezeway.",
    blocksHandoff: true,
    breezewayTemplateId: "208329",
    sortOrder: 560,
  },
  {
    key: "phase3_work_orders_create_work_order_for_landscaping_if_nece",
    stage: "phase3_work_orders",
    title: "Create work order for landscaping (if necessary)",
    role: "Project Manager",
    detail:
      "Instructions:\n Please create and schedule work orders in Breezeway for any approved landscaping.\n\n We do not have templates regarding landscaping, because every home requires something different. When creating a work order, please keep in mind the following:\n Be specific in your instructions to the contractor.\n Try to use bullet points to make instructions easier to read.\n Attach reference photos w/ or w/o markups whenever you think they will be helpful.\n\n As you create work orders, you may group similar jobs within work orders (like different painting tasks, or different outdoor tasks). One exception is furniture assembly tasks. Please do not group any furniture assembly tasks on work orders with any other tasks. (Furniture assembly tasks are classed differently than other jobs, and the home buyer pays us for them differently)\n\n Assess the sod at home if necessary; …",
    blocksHandoff: false,
    sortOrder: 570,
  },
  {
    key: "phase3_work_orders_create_work_order_for_assembly_of_boxed_f",
    stage: "phase3_work_orders",
    title: "Create work order for assembly of boxed furniture",
    role: "Project Manager",
    detail:
      "Instructions:\n Please create and schedule a work order in Breezeway to have the boxed furniture items assembled at the property.\n\n Use the New House Setup - Assemble Boxed Furniture template in Breezeway, which contains the directions below.\n\n Please attach a list of boxed furniture items from the pick list to the work order.\n\n Please request the handyman take photos of all assembled items.\n\n Please request handyman notify project manager if any boxed furniture items are missing.\n\nIMPORTANT INSTRUCTIONS FOR PROJECT MANAGER: \n* Please send the handyman a PDF listing of the boxed furniture for the home. \n* Please do not send the Smartsheet link. \n\n*Please assemble, in the order stated below, any boxed furniture that has arrived via transport or shipping. (Pls retain all shipping boxes until items can be checked for damage to ensure we do not need to return ship …",
    blocksHandoff: true,
    breezewayTemplateId: "134112",
    sortOrder: 580,
  },
  {
    key: "phase3_work_orders_create_work_order_for_installation_of_tv_",
    stage: "phase3_work_orders",
    title: "Create work order for installation of TV mounts",
    role: "Project Manager",
    detail:
      "Time installation to coincide with placement of furniture and arrival of TVs, as it is easier to center the TV mounts on the wall when these items are present.\n\nInstructions:\n Please create and schedule a work order in Breezeway to have the TVs mounted at the property.\n\n Use the New House Setup - Install TV Mounts template in Breezeway, which contains the directions below.\n\n Please attach the TV mount instructions from the Design Plan to the work order.\n\nTV MOUNT INSTRUCTIONS:\nPlease include TV mount instructions from the Design Plan Project in this work order.",
    blocksHandoff: true,
    breezewayTemplateId: "157687",
    sortOrder: 590,
  },
  {
    key: "phase3_work_orders_create_work_order_for_unboxing_washing_di",
    stage: "phase3_work_orders",
    title: "Create work order for unboxing / washing dishes / setting out essentials",
    role: "Project Manager",
    detail:
      "Instructions:\n Please create and schedule a work order in Breezeway to have the dishes washed and essentials set out at the property.\n\n Use the New House Setup - Setting out Essentials template in Breezeway, which contains a Requirements section that provides the below directions.\n\nKitchen\n wash dishes, silverware, utensils, cutting boards, strainers, pots and pans, bowls and baking dishes in dishwasher\n wash coffee carafe by hand\n remove packing materials from chopper, crock pot, coffee maker, etc.\n unbox kitchen trash can and put empty liner inside\n put kitchen towels, oven mitts and dish cloths in a drawer\n put foil, saran wrap, parchment paper, zip locks and chip clips in a drawer or on a shelf in pantry\n put together lazy susan and put spices on/near it\n put a Mrs. Meyer's dish soap, hand soap and scrub brush on kitchen counter (put extras in supply closet)\n put …",
    blocksHandoff: true,
    sortOrder: 600,
  },
  {
    key: "phase3_work_orders_create_work_order_to_unbox_and_clean_prim",
    stage: "phase3_work_orders",
    title: "Create work order to unbox and clean primary dishware",
    role: "Project Manager",
    detail:
      "Instructions: \n1.) Create work order for handyman to unbox the primary dishware and wash items in the dishwasher (this is done in advance of staging to help the staging team, if possible)\n\n2.) Use the New House Setup - Unbox/Clean Primary Dishware template in Breezeway. \n\n3.) These specific items include:\n Dishes, silverware, utensils, cutting boards, strainers, pots and pans, bowls and baking dishes in dishwasher\n wash coffee carafe by hand\n remove packing materials from chopper, crock pot, coffee maker, etc.",
    blocksHandoff: true,
    breezewayTemplateId: "209640",
    sortOrder: 610,
  },
  {
    key: "phase3_work_orders_create_work_order_for_washing_linens_and_",
    stage: "phase3_work_orders",
    title: "Create work order for washing linens and making beds before staging",
    role: "Project Manager",
    detail:
      "Instructions:\n Please create and schedule a work order in Breezeway to have the linens washed and beds made at the property.\n\n Use the New House Setup - Make Beds template in Breezeway, which contains the below instructions. \n\nPLEASE WASH SHEETS AND TOWELS:\n Sheets: # king set and # queen sets. Please fold sheets and place in sheet boxes\n\n Towels: Bath towels, hand towels, kitchen towels, wash cloths and dish cloths. Please fold towels and put in a zippered case\n\nWASH DUVET COVERS (at house) AND MAKE BEDS:\n1. zipper encasement\n2. mattress pad\n3. sheets\n4. duvet (or comforter) inside duvet cover (put on duvet after it is fresh from the dryer and wrinkle free or steam duvet cover on bed)\n5. 4 pillows inside zippered encasements and pillow cases",
    blocksHandoff: true,
    breezewayTemplateId: "134129",
    sortOrder: 620,
  },
  {
    key: "phase3_work_orders_follow_up_on_home_improvement_estimate_w_",
    stage: "phase3_work_orders",
    title: "Follow up on home improvement estimate w/ owner (if necessary)",
    role: "Project Manager",
    detail:
      "Instructions:\n If you have not yet received a response on the repair/improvement cost projections sent to the prospective buyer, follow up with an email encouraging them to contact us if we can answer any questions regarding the previous email. \n\n You may be able to send this at the same time that the property management agreement goes to the prospective buyer. Check with the onboarding manager on whether this has already been sent to the buyer or not.",
    blocksHandoff: false,
    sortOrder: 630,
  },
  {
    key: "phase3_work_orders_create_work_order_for_staging_decor",
    stage: "phase3_work_orders",
    title: "Create work order for staging decor",
    role: "Project Manager",
    detail:
      "Instructions:\n Please create and schedule a work order in Breezeway to have the decor staged at the property.\n\n Use the New House Setup - Stage Decor template in Breezeway, which contains the below instructions. \n\n Please provide staging team with a PUBLIC PDF copy of the decor pick list (reformatted to remove the order #s, retailer names, price).\n\n Please do not send the Smartsheet link to the staging team",
    blocksHandoff: true,
    breezewayTemplateId: "146399",
    sortOrder: 640,
  },
  {
    key: "phase3_work_orders_create_work_order_to_set_up_roku_tvs",
    stage: "phase3_work_orders",
    title: "Create work order to set up Roku TVs",
    role: "Project Manager",
    detail:
      "Instructions:\n Please create and schedule a work order in Breezeway to have the two Roku TVs activated at the property.\n\n Use the New House Setup - Setting Up Roku TVs template in Breezeway, which contains the directions below.\n\n Please also attach the window coverings instructions in the Design Plan to the work order so that handyman will know which curtain rod to install for each window.",
    blocksHandoff: true,
    breezewayTemplateId: "158476",
    sortOrder: 650,
  },
  {
    key: "phase3_work_orders_create_work_orders_for_unboxing_inventory",
    stage: "phase3_work_orders",
    title: "Create work orders for unboxing inventory/checking for damage",
    role: "Project Manager",
    detail:
      "Instructions:\n Please create and schedule 2 work orders in Breezeway to have deliveries unboxed and inventoried at the property by the handyman. The first work order should be scheduled approximately halfway through the inventory delivery process, and the second should be scheduled at the end (for example - if boxed inventory is scheduled to arrive at the property for the next 12 days, you might schedule the first inventory to occur at Day 5 or 6 and the second to occur at Day 11 or 12).\n\n Use the New House Setup - Unbox Deliveries / Check for Damage template in Breezeway, which contains the directions below.\n\n \n\nTEXT IN BREEZEWAY WORK ORDER:\nProject Manager Name: \nProject Manager Email:\n\n1.) Please move the garage deliveries into the home and unbox them. (The boxed furniture items can remain in the garage and boxed until they are assembled.) \n\n2.) As you are …",
    blocksHandoff: true,
    breezewayTemplateId: "187225",
    sortOrder: 660,
  },
  {
    key: "phase3_work_orders_adjust_project_plan_dates_as_necessary_fo",
    stage: "phase3_work_orders",
    title: "Adjust project plan dates as necessary for the upcoming week",
    role: "Project Manager",
    blocksHandoff: true,
    sortOrder: 670,
  },
  {
    key: "phase3_work_orders_update_project_status",
    stage: "phase3_work_orders",
    title: "Update project status",
    role: "Project Manager",
    detail:
      "Update the project status on this home in Resolve and note anything the team needs to be aware of.",
    blocksHandoff: false,
    sortOrder: 680,
  },
  {
    key: "phase3_work_orders_conduct_review_of_design_plan_and_budget",
    stage: "phase3_work_orders",
    title: "Conduct review of design plan and budget",
    role: "Lead Designer",
    detail:
      "Instructions:\n Review the property design plan for the following:\n ARHA design requirements\n Budget parameters, utilizing the https://www.dropbox.com/scl/fi/98dsfjs04xm44h4bnlyr6/New-Home-Furnishing-Budget-Calculator.xlsx?rlkey=zrs0nplt4a22yytzx9wep7ewe&st=y21d5tco&dl=0\n If the design plan requires modifications, notify the Designer of the required modifications and completes a final review once the changes have been made.",
    blocksHandoff: true,
    sortOrder: 690,
  },
  {
    key: "phase3_work_orders_obtain_design_plan_budget_approval_from_t",
    stage: "phase3_work_orders",
    title: "Obtain design plan budget approval from the CEO",
    role: "Onboarding Manager",
    detail:
      "Once the design plan has been reviewed and any necessary modifications made, the Onboarding Manager provides budget information to the CEO for approval.\n\nThe CEO reviews the budget and notifies the Onboarding Manager of approval.",
    blocksHandoff: true,
    sortOrder: 700,
  },
  {
    key: "phase3_work_orders_send_mood_boards_to_owner",
    stage: "phase3_work_orders",
    title: "Send Mood Boards to Owner",
    role: "Lead Designer",
    detail:
      "Instructions:\n Send the owner the mood boards for all rooms within the home.\n Utilize the sample email below and remember the following:\n Pls ensure that you copy the PDF of the mood boards. \n CC the Project Manager on the correspondence\n\nSample Email:\n\nSubject: Your Design Plan and Next Steps - [Address]\n\nDear [owner], \n\nI’m excited to share the customized design plan we’ve created for your new home! Attached, you’ll find mood boards for each of your spaces. These boards are tailored to the unique features of your home, incorporating neutral tones, textures, and soothing muted colors that will create a warm, inviting atmosphere.\n\nNext Steps:\nOnce you have closed on your property, we will issue an invoice for 50% of the total furnishing price. This upfront payment allows us to order the furniture and décor for your home. Once everything has been ordered and delivered …",
    blocksHandoff: true,
    // Regular owners: evidence that the boards were sent completes the step.
    // Active Owner Program participants: sending moves the step to awaiting
    // owner approval, and only the enrolled homeowner can close it.
    evidenceRequired: true,
    ownerApprovalWhenActiveOwner: true,
    sortOrder: 710,
  },
  {
    key: "phase3_work_orders_send_design_budget_approval_invoice_reque",
    stage: "phase3_work_orders",
    title: "Send Design Budget Approval & Invoice Request to Accounting",
    role: "Onboarding Manager",
    detail:
      'Instructions:\nNotify accounting team that the design budget has been approved and they can move forward creating invoices for the repair and furnishing and decor costs. \n\n"Hey team, \n\nWe are ready to invoice for the furniture package and home improvements/repairs at [Property Address] (Owner). Closing is [Date] and the invoice can be [date], or when James has reviewed it. Can you help me with making the following 3 invoices?\n\nTotal Costs: \nFurnishings:\n3 Bedroom - $\nExtended Patio - $\nBonus Room - $\nTotal Furnishings $\n\nTotal Make Ready Repairs: $\n\nFurnishings & Repairs – Initial Invoice\n1/2 of Furniture package price - $\n1/2 of Additional rooms (extended patio & bonus room) - $\nHalf of the total approved home improvement/repair estimate - $\nTotal of first invoice - $\n\nInvoice #2: Second Furnishing Invoice (Due in 14 Days)\n1/2 of Furniture package price - $\n1/2 of …',
    blocksHandoff: true,
    sortOrder: 720,
  },
  {
    key: "phase4_purchasing_closing_date",
    stage: "phase4_purchasing",
    title: "CLOSING DATE",
    role: "Project Manager",
    blocksHandoff: true,
    anchor: "planned_closing",
    offsetDays: 0,
    sortOrder: 730,
  },
  {
    key: "phase4_purchasing_verify_closing_took_place_and_obtain_prope",
    stage: "phase4_purchasing",
    title: "Verify closing took place and obtain property access",
    role: "Project Manager",
    detail:
      "Instructions:\n Ensure that if the home is in a gated neighborhood, we obtain the access code/fob(s) for access to the neighborhood. (Check with the Realtor on this.)\n\n Request an ARHA representative pick up keys from title company, if necessary. (Check with the Realtor on whether keys will be left at title company or left at the property. If left at the property, be sure we know where to find them.)\n\n Verify if the property has an alarm code & add it to the description of the project, listed under official USPS address.",
    blocksHandoff: true,
    evidenceRequired: true,
    anchor: "actual_closing",
    offsetDays: 0,
    sortOrder: 740,
  },
  {
    key: "phase4_purchasing_confirm_receipt_of_mail_keys_if_applicable",
    stage: "phase4_purchasing",
    title: "Confirm receipt of mail keys, if applicable",
    role: "Project Manager",
    detail:
      "Instructions:\nIf you requested mail keys from the Realtor, confirm that these have been left for us.",
    blocksHandoff: true,
    sortOrder: 750,
  },
  {
    key: "phase4_purchasing_send_congratulatory_closing_email_with_tim",
    stage: "phase4_purchasing",
    title: "Send congratulatory closing email with timeline to owner",
    role: "Project Manager",
    detail:
      "Instructions:\n Following close, send the owner a congratulatory email that contains rough timelines for the home setup process. You will use the project plan dates for this, so be sure the plan has been updated and tasks spread across the setup timeframe in a realistic fashion. Be sure not to make guarantees on any deadlines, and keep the ending date somewhat open.\n REMEMBER TO UPDATE THE DATES IN THE BELOW SAMPLE EMAIL AND MODIFY BULLETS/LANGUAGE TO FIT YOUR PROPERTY.\n CC the Onboarding Manager on the correspondence.\n\nSample email:\n\nGood morning, Owner\n \nCongratulations on closing! It's time for us to get started in earnest on your new home! \n \nWhat's Next?\nOver the next 2-3 weeks, we will be working diligently on the following items:\n \nWeek 1 (March 18th – 22nd)\n \n Home access/security equipment installation - Doorbell and spotlight cameras will be installed at the …",
    blocksHandoff: true,
    anchor: "actual_closing",
    offsetDays: 0,
    sortOrder: 760,
  },
  {
    key: "phase4_purchasing_confirm_approval_of_the_design_plan_budget",
    stage: "phase4_purchasing",
    title: "Confirm approval of the design plan/budget with Lead Designer",
    role: "Project Manager",
    detail:
      "Confirm that the interior design plan has been reviewed and approved by the Lead Designer before purchasing any items",
    blocksHandoff: true,
    sortOrder: 770,
  },
  {
    key: "phase4_purchasing_adjust_the_new_house_prep_blocking_for_thi",
    stage: "phase4_purchasing",
    title: "Adjust the New House Prep blocking for this property in Owner Rez",
    role: "Project Manager",
    detail:
      'Adjust the blocking for "new house prep" to 5 weeks after the closing date. \n\nLeave note in the title in Owner Rez block for the projected completion date. \nExample: "Estimated completion 1/15/2025"',
    blocksHandoff: true,
    sortOrder: 780,
  },
  {
    key: "phase4_purchasing_confirm_initial_furnishings_repairs_invoic",
    stage: "phase4_purchasing",
    title: "Confirm Initial Furnishings & Repairs Invoice Sent",
    role: "Project Manager",
    detail:
      "Instructions:\nClose this task once accounting has confirmed the furniture invoice has been sent. Send any follow ups to confirm status to the CFO.",
    blocksHandoff: false, // financial closeout — tracked after operational handoff,
    sortOrder: 790,
  },
  {
    key: "phase4_purchasing_asap_assign_work_orders_for_security_insta",
    stage: "phase4_purchasing",
    title: "ASAP - Assign work orders for security installation and connection",
    role: "Project Manager",
    detail:
      'Please include the task "Connect Yale Locks" as a QC for installer to ensure the app is working. \n PM or Onboarding Manager should confirm the address shows up on the Yale app following the install.',
    blocksHandoff: true,
    sortOrder: 800,
  },
  {
    key: "phase4_purchasing_asap_purchase_large_furniture_items_for_th",
    stage: "phase4_purchasing",
    title: "ASAP - Purchase large furniture items for the home and schedule delivery",
    role: "Project Manager",
    detail:
      "Instructions:\n1.) Order large furniture items from vendor (Living Spaces), and schedule delivery.\n2.) Notify setup contractor of the scheduled delivery date and schedule work order to meet the delivery.\n\nWhich Card to Use for Company Purchases\nFollow this guide any time you're making a purchase on behalf of ARHA. Use the correct card based on the vendor, then log every expense — no exceptions.\n\n🛒 Wayfair\n Use Josh's credit card — card number is in the Telegram thread.\n📦 Amazon\n Use Kati's Amazon AMEX ending in 1130.\n🌐 All Other Websites\n Use your personal Ramp card.",
    blocksHandoff: true,
    sortOrder: 810,
  },
  {
    key: "phase4_purchasing_asap_purchase_mattresses_for_the_home",
    stage: "phase4_purchasing",
    title: "ASAP - Purchase mattresses for the home",
    role: "Project Manager",
    detail:
      "Which Card to Use for Company Purchases\nFollow this guide any time you're making a purchase on behalf of ARHA. Use the correct card based on the vendor, then log every expense — no exceptions.\n\n🛒 Wayfair\n Use Josh's credit card — card number is in the Telegram thread.\n📦 Amazon\n Use Kati's Amazon AMEX ending in 1130.\n🌐 All Other Websites\n Use your personal Ramp card.",
    blocksHandoff: true,
    sortOrder: 820,
  },
  {
    key: "phase4_purchasing_create_work_order_to_meet_furniture_delive",
    stage: "phase4_purchasing",
    title: "Create work order to meet furniture delivery",
    role: "Project Manager",
    detail:
      "Instructions:\n Please utilize the New House Setup - Meet Furniture Delivery template in Breezeway to create a work order. *\n Also attach the 3D Floorplans from the Design Plan to the work order. Label the bedrooms in the floorplan so that the handyman will know which room is which. Also indicate which bedroom furnishings belong in each bedroom.\n Lastly, attach a list of the furniture items that are being delivered, along with pictures, from the furnishings pick list. \n\n(Directions in the template)\nPROCEDURE FOR MEETING FURNITURE DELIVERIES:\n Direct the placement of furniture according to the 3D renderings\n Immediately review the order information provided by the project manager against what was delivered and notify project manager if any items are missing\n Check for damages, notify the delivery driver and send photos to project manager\n Remove packing material and …",
    blocksHandoff: true,
    breezewayTemplateId: "134123",
    sortOrder: 830,
  },
  {
    key: "phase4_purchasing_purchase_essentials_for_property",
    stage: "phase4_purchasing",
    title: "Purchase essentials for property",
    role: "Project Manager",
    detail:
      "Instructions:\n Purchase items indicated on the Essentials list in Smartsheet and have them delivered directly to the property. \n Indicate on the purchasing list that each item has been purchased and add the projected delivery date. \n For all vendors, with the exception of Amazon, be sure to log the expense on this project in Resolve.\n\nWhich Card to Use for Company Purchases\nFollow this guide any time you're making a purchase on behalf of ARHA. Use the correct card based on the vendor, then log every expense — no exceptions.\n\n🛒 Wayfair\n Use Josh's credit card — card number is in the Telegram thread.\n📦 Amazon\n Use Kati's Amazon AMEX ending in 1130.\n🌐 All Other Websites\n Use your personal Ramp card.",
    blocksHandoff: true,
    sortOrder: 840,
  },
  {
    key: "phase4_purchasing_create_work_order_for_supply_box_assembly",
    stage: "phase4_purchasing",
    title: "Create work order for supply box assembly",
    role: "Project Manager",
    detail:
      "Instructions:\n1.) Purchase items for the supply/storage box and send them to the home. Items can be found on the Closet Storage Supplies list in the Amazon Business Prime account\n\nStorage Box Inventory: \n Portable file box\n 4 spare Roku TV Remotes (1 in the top and 3 in the box) \n 4 spare garage door openers. Please make sure to program them before putting them in the box \n 16 spare batteries for each of the following: AA and AAA. (5 in the top and 11 in the box) \n 4 spare batteries 9V (1 in top and 3 in the box) \n 8 standard light bulbs \n 1 spare backup key for the fireplace (if home has a fireplace and it doesn't have a switch) \n 2 bedroom/bathroom emergency keys (1 flat and 1 pointed)\n\n2.) Create a work order for the contractor who is working the home setup to put together the box, according to the list above, and place it in the master bedroom closet.",
    blocksHandoff: true,
    breezewayTemplateId: "590801",
    sortOrder: 850,
  },
  {
    key: "phase4_purchasing_purchase_furnishings_and_decor_for_new_hom",
    stage: "phase4_purchasing",
    title: "Purchase furnishings and décor for new home",
    role: "Project Manager",
    detail:
      "Instructions:\n Purchase items indicated on the Furnishings and Decor purchasing lists in Houzz.\n Large furniture deliveries will be directly to the property, as well as assembled by the vendor onsite. Someone will need to be present during the delivery to instruct the delivery personnel where to place each piece of furniture.\n Indicate on the pick list that each item has been purchased and add the projected delivery date. \n For all vendors, with the exception of Amazon, be sure to log the expense on this project in Resolve.",
    blocksHandoff: true,
    subtasks: [
      "Ensure that bedroom rugs (if any) arrive at the house before furniture is delivered/assembled",
      "Validate closing prior to purchasing large furniture items or house-specific items.",
    ],
    sortOrder: 860,
  },
  {
    key: "phase4_purchasing_arrange_for_placement_of_area_rugs_prior_t",
    stage: "phase4_purchasing",
    title: "Arrange for placement of area rugs prior to delivery of beds (hardwood bedrooms only)",
    role: "Project Manager",
    blocksHandoff: true,
    sortOrder: 870,
  },
  {
    key: "phase4_purchasing_order_custom_blinds_for_the_home_if_necess",
    stage: "phase4_purchasing",
    title: "Order custom blinds for the home (if necessary)",
    role: "Project Manager",
    detail:
      "To view submitted responses to the Window Measurements form, open the form responses on this task in Resolve.",
    blocksHandoff: false,
    sortOrder: 880,
  },
  {
    key: "phase4_purchasing_purchase_appliances_and_schedule_delivery",
    stage: "phase4_purchasing",
    title: "Purchase appliances and schedule delivery",
    role: "Project Manager",
    detail:
      "Appliances must be purchased AFTER closing has taken place. \n\n Confirm that there are no appliances at the property. \n If there are appliances, ensure that all work after staging team provides a test for any appliances left. \n Send a message to CEO and Onboarding Manager to discuss how to proceed. \n For all properties: \n Order from Lowes and schedule a delivery. This delivery can typically be scheduled the same day as the large furniture delivery. \n Preferred models listed below. Please verify spacing of W/D and Refrigerator & spacing for the door swing on the fridge. \n\nPreferred Models (GOAL - stay under $2,800 for order including delivery)\nWasher - GTW485ASWWB\nDryer - GTD48EASWWB\nRefrigerator - GRSC2352AF",
    blocksHandoff: true,
    sortOrder: 890,
  },
  {
    key: "phase4_purchasing_create_work_order_to_meet_appliance_delive",
    stage: "phase4_purchasing",
    title: "Create work order to meet appliance delivery",
    role: "Project Manager",
    detail:
      "Instructions:\nUtilize the New House Setup - Meet Appliance Delivery & Test Appliances template in Breezeway.\n\n If utilizing Metro Appliance - no one is required to be present for delivery. \n If someone is present during delivery, please have them check and test the appliances as indicated below.\n If no one is present during delivery, please create a work order for someone to check and test the appliances soon after delivery. (Usually this will be a handyman or cleaner/stager.) \n\n(Directions included on template)\nPROCEDURE FOR CHECKING/TESTING APPLIANCES\n Immediately check for damage, notify delivery driver and send photos to project manager\n Run a test load in the washer\n Run refrigerator water/ice through recommended cycles\n Remove packing materials\n Place manuals in supply closet (top shelf)",
    blocksHandoff: true,
    breezewayTemplateId: "134119",
    sortOrder: 900,
  },
  {
    key: "phase4_purchasing_change_cox_network_id_password",
    stage: "phase4_purchasing",
    title: "Change Cox network id/password",
    role: "Utilities Coordinator",
    blocksHandoff: true,
    subtasks: ["Update internet ID & password in Breezeway"],
    sortOrder: 910,
  },
  {
    key: "phase4_purchasing_assign_all_home_improvement_cleaning_stagi",
    stage: "phase4_purchasing",
    title: "Assign all home improvement, cleaning, staging and landscaping work orders",
    role: "Project Manager",
    detail:
      "Reference: the Resolve vendor directory.\n Add assignee names to previously-created work orders\n Verify dates on work orders to ensure work will occur in sequence that makes sense\n Ensure that work orders contain all instructions and supplemental attachments to assist vendor in completing the assigned task(s) successfully.",
    blocksHandoff: true,
    sortOrder: 920,
  },
  {
    key: "phase4_purchasing_schedule_professional_photo_shoot_for_stag",
    stage: "phase4_purchasing",
    title: "Schedule professional photo shoot for staged home",
    role: "Project Manager",
    detail:
      "INSTRUCTIONS:\n\n(IMPORTANT NOTE: Our DFW photographer must be scheduled at least 7-10 days prior to the photo shoot date, so please schedule with her as soon as you have a good idea of when your home will be ready!)\n\nOKLAHOMA CITY AND TULSA \n For Oklahoma homes in the Oklahoma City and Tulsa areas, we use Flow Photography: https://flowphotos.com/\n\n Please see the below Scribe for specific instructions regarding ordering photos. Payment is not due until photos are processed; the ordering steps are in the Resolve playbook library.\n\nDFW\n For homes in the DFW area, we use Nicole Perdue Shoot 2 Sell. This information is in the Resolve vendor directory. \n\nPlease note: All photo and video shoots must include the Airbnb/VRBO marketing package to secure usage rights.",
    blocksHandoff: true,
    sortOrder: 930,
  },
  {
    key: "phase4_purchasing_interior_camera_check",
    stage: "phase4_purchasing",
    title: "Interior Camera Check",
    role: "Project Manager",
    detail:
      "Review any notes on the pre-work inspection in Resolve to ensure we will not breach a guests privacy during their stay after onboarding with internal cameras. \n\nIf there are any cameras noted, please schedule a handyman to quote removing these. Please retain Onboarding Manager approval as needed.",
    blocksHandoff: true,
    evidenceRequired: true,
    sortOrder: 940,
  },
  {
    key: "phase4_purchasing_schedule_lawn_maintenance_for_2_days_befor",
    stage: "phase4_purchasing",
    title: "Schedule lawn maintenance for 2 days before photos",
    role: "Project Manager",
    detail:
      "Reference: the Resolve vendor directory.\n\nThere is a current photo of the lawn on the pre work inspection. Open the Pre Work Inspection submission on this project in Resolve to view.",
    blocksHandoff: true,
    sortOrder: 950,
  },
  {
    key: "phase4_purchasing_schedule_a_pre_cleaning_for_a_property_if_",
    stage: "phase4_purchasing",
    title: "Schedule a pre cleaning for a property, if needed",
    role: "Project Manager",
    detail:
      "Ask the staging team if there needs to be a pre cleaning at the property. \n Are the interiors of the cabinets clean? \n Are areas where a large rug will be placed cleaned? Do we need to mop prior to furniture delivery?\n*This primarily affects our OKC Metro properties. We can schedule Elizabeth if needed so Jeff can unload all essentials and dishware during the staging process.",
    blocksHandoff: true,
    sortOrder: 960,
  },
  {
    key: "phase4_purchasing_check_for_garage_door_remotes",
    stage: "phase4_purchasing",
    title: "Check for garage door remotes",
    role: "Project Manager",
    detail:
      "Instructions:\n Check the completed lock installation work order to confirm the # of garage door remotes present at the property.\n\n If property does not have at least two programmed garage door remotes, order additional remotes (so that there are two - they do not have to be the same brand).\n\n Create a work order to have the handyman program any new remotes",
    blocksHandoff: true,
    subtasks: ["Order additional remotes", "Create work order for handyman to program remotes"],
    sortOrder: 970,
  },
  {
    key: "phase4_purchasing_create_work_order_to_have_someone_place_ma",
    stage: "phase4_purchasing",
    title: "Create work order to have someone place mattresses on beds",
    role: "Project Manager",
    detail:
      "This task is necessary only if mattresses arrive before the beds are delivered, and if no one has placed the mattresses on the beds yet.",
    blocksHandoff: true,
    sortOrder: 980,
  },
  {
    key: "phase4_purchasing_order_supplies_create_work_orders_indicate",
    stage: "phase4_purchasing",
    title: "Order supplies/create work orders indicated in Pre-Work Inspection results",
    role: "Project Manager",
    detail:
      "1.) Check the Pre-Work Inspection record for this home in Resolve.\n\n2.) Order air filters in the size(s) and quantity(ies) indicated on the Master File. Order a 5-year water filter for the fridge, if it is not new\n\n3.) Ship these items to the property for installation by the handyman.\n\n4.) Create work orders to have the air and water filters installed by the handyman.\n\n5.) After confirming information is accurate, please send a message to the Onboarding Manager to inform them that we can add the information to the Properties Information Database.",
    blocksHandoff: true,
    sortOrder: 990,
  },
  {
    key: "phase4_purchasing_begin_tracking_inventory_delivery",
    stage: "phase4_purchasing",
    title: "Begin tracking inventory delivery",
    role: "Project Manager",
    detail:
      "Instructions:\n Using the inventory delivery dates on the purchasing list(s), track the delivery of furnishings, decor and essentials. \n Please perform this tracking task regularly throughout the inventory delivery timeframe. The more quickly we can identify an item that is delayed, lost or order that has been cancelled by the retailer, the more quickly we can find and purchase an alternative item.\n It is suggested that you create and schedule 4-5 duplicates of this task and perform this check every 2 days or so while items are being delivered to the property.",
    blocksHandoff: true,
    sortOrder: 1000,
  },
  {
    key: "phase4_purchasing_schedule_manage_pest_control",
    stage: "phase4_purchasing",
    title: "Schedule & Manage Pest Control",
    role: "Project Manager",
    detail:
      "Pest control services must be scheduled for this property as part of onboarding. This applies to homes onboarded between April and August:\n Interior spraying is mandatory\n Exterior spraying is required only if recommended by the vendor\n Use the standard pest control vendor unless otherwise discussed. Be sure to add pest control to both the Make Ready Estimate and the final expense tracking.\nPlease reference the Resolve vendor directory to confirm if we have a preferred vendor in the area. Schedule service to be completed during the first week of onboarding. The staging team may or may not need to be present, depending on vendor needs.\nBe sure to:\n Add this cost plus internal labor time to the Make Ready Estimate\n Include it in the House Cost Review Sheet\nAdd this cost + …",
    blocksHandoff: true,
    sortOrder: 1010,
  },
  {
    key: "phase4_purchasing_store_hoa_documents_in_onedrive_property_f",
    stage: "phase4_purchasing",
    title: "Store HOA documents in OneDrive Property folder",
    role: "Project Manager",
    detail:
      "Instructions:\nIf one has not already been created, create a folder in the https://arealhomeaway-my.sharepoint.com/:f:/p/info/EuiokdYkJlBMqQ6pudgd1hIBp6BhNQYyo3U928aezFWW8Q?e=KK3j0Q on OneDrive with the neighborhood HOA Covenants, Conditions & Restrictions (CC&Rs) saved to the folder. \n\nIf we do not have these, please request them from the Realtor.",
    blocksHandoff: true,
    sortOrder: 1020,
  },
  {
    key: "phase4_purchasing_provide_weekly_status_update_to_owner_upda",
    stage: "phase4_purchasing",
    title: "Provide weekly status update to owner / update project plan dates",
    role: "Project Manager",
    blocksHandoff: true,
    sortOrder: 1030,
  },
  {
    key: "phase4_purchasing_update_project_status",
    stage: "phase4_purchasing",
    title: "Update project status",
    role: "Project Manager",
    detail:
      "Update the project status on this home in Resolve and note anything the team needs to be aware of.",
    blocksHandoff: false,
    sortOrder: 1040,
  },
  {
    key: "phase4_purchasing_remove_the_realtor_s_from_telegram",
    stage: "phase4_purchasing",
    title: "Remove the realtor(s) from Telegram",
    role: "Onboarding Admin",
    blocksHandoff: true,
    sortOrder: 1050,
  },
  {
    key: "phase5_monitor_monitor_and_confirm_completion_of_all_repairs",
    stage: "phase5_monitor",
    title:
      "Monitor and confirm completion of all repairs, transport of all furnishings and décor, and completion of cleaning, stocking and staging of home",
    role: "Project Manager",
    blocksHandoff: true,
    sortOrder: 1060,
  },
  {
    key: "phase5_monitor_approve_carpet_work_flooring",
    stage: "phase5_monitor",
    title: "Approve carpet work/flooring",
    role: "Project Manager",
    detail:
      "Please add information into thehttps://app.smartsheet.com/sheets/rCqH7WMVhMXg2f43RHgr6J5P6V45xq6vjPmfHC91",
    blocksHandoff: true,
    evidenceRequired: true,
    sortOrder: 1070,
  },
  {
    key: "phase5_monitor_approve_repair_work",
    stage: "phase5_monitor",
    title: "Approve repair work",
    role: "Project Manager",
    detail:
      "Please add information into thehttps://app.smartsheet.com/sheets/rCqH7WMVhMXg2f43RHgr6J5P6V45xq6vjPmfHC91",
    blocksHandoff: true,
    evidenceRequired: true,
    sortOrder: 1080,
  },
  {
    key: "phase5_monitor_schedule_change_smoke_detector_batteries_if_a",
    stage: "phase5_monitor",
    title: 'Schedule "Change Smoke Detector Batteries" if applicable',
    role: "Project Manager",
    detail:
      "Please review the Standard Inspection and assign a breezeway task for the staging team to change the smoke detector batteries if:\n Not Hardwired\n Not a new construction home",
    blocksHandoff: true,
    sortOrder: 1090,
  },
  {
    key: "phase5_monitor_approve_paint_work",
    stage: "phase5_monitor",
    title: "Approve paint work",
    role: "Project Manager",
    detail:
      "Please add information into thehttps://app.smartsheet.com/sheets/rCqH7WMVhMXg2f43RHgr6J5P6V45xq6vjPmfHC91",
    blocksHandoff: true,
    evidenceRequired: true,
    sortOrder: 1100,
  },
  {
    key: "phase5_monitor_create_a_work_order_for_handyman_to_pick_up_s",
    stage: "phase5_monitor",
    title: "Create a work order for handyman to pick up surveillance signs",
    role: "Project Manager",
    detail:
      "INSTRUCTIONS:\nCreate a work order for the handyman to remove the surveillance signs, Ring stick up camera and hedge delivery box (if applicable) at least one day prior to marketing photos.",
    blocksHandoff: true,
    sortOrder: 1110,
  },
  {
    key: "phase5_monitor_confirm_with_staging_team_that_roku_tv_s_were",
    stage: "phase5_monitor",
    title: "Confirm with staging team that ROKU tv's were set",
    role: "Project Manager",
    blocksHandoff: true,
    sortOrder: 1120,
  },
  {
    key: "phase5_monitor_approve_landscaping_work",
    stage: "phase5_monitor",
    title: "Approve landscaping work",
    role: "Project Manager",
    detail:
      "Please add information into thehttps://app.smartsheet.com/sheets/rCqH7WMVhMXg2f43RHgr6J5P6V45xq6vjPmfHC91",
    blocksHandoff: true,
    evidenceRequired: true,
    sortOrder: 1130,
  },
  {
    key: "phase5_monitor_activate_roku_devices",
    stage: "phase5_monitor",
    title: "Activate Roku Devices",
    role: "Project Manager",
    blocksHandoff: true,
    sortOrder: 1140,
  },
  {
    key: "phase5_monitor_approve_cleaning",
    stage: "phase5_monitor",
    title: "Approve cleaning",
    role: "Project Manager",
    blocksHandoff: true,
    evidenceRequired: true,
    sortOrder: 1150,
  },
  {
    key: "phase5_monitor_approve_staging_work",
    stage: "phase5_monitor",
    title: "Approve staging work",
    role: "Project Manager",
    blocksHandoff: true,
    evidenceRequired: true,
    sortOrder: 1160,
  },
  {
    key: "phase5_monitor_put_home_on_regular_lawn_maintenance_schedule",
    stage: "phase5_monitor",
    title: "Put home on regular lawn maintenance schedule",
    role: "Project Manager",
    detail:
      "Please use this video to guide you through this setup - https://arealhomeaway-my.sharepoint.com/personal/micah_sinor_arealhomeaway_com/_layouts/15/stream.aspx?id=%2Fpersonal%2Fmicah%5Fsinor%5Farealhomeaway%5Fcom%2FDocuments%2FAttachments%2FAssigning%20Lawn%20Vendor%20in%20BW%2Emp4&ct=1750346741939&or=OWA%2DNT%2DMail&cid=be568dd6%2Dd0e6%2D5f10%2D7117%2D7680fedc891e&ga=1&referrer=StreamWebApp%2EWeb&referrerScenario=AddressBarCopied%2Eview%2E806a37b9%2Dbc8c%2D4c16%2D9cd7%2Db468adde4f35",
    blocksHandoff: true,
    sortOrder: 1170,
  },
  {
    key: "phase5_monitor_provide_weekly_status_update_to_owner_update_",
    stage: "phase5_monitor",
    title: "Provide weekly status update to owner / update project plan dates",
    role: "Project Manager",
    blocksHandoff: true,
    sortOrder: 1180,
  },
  {
    key: "phase5_monitor_set_up_the_trash_valet_service",
    stage: "phase5_monitor",
    title: "Set up the Trash Valet Service",
    role: "Project Manager",
    detail:
      "1. Find Trash Valet Vendor \n Open the Resolve vendor directory.\n Locate and copy the Trash Valet vendor name and contact email for the market in which the home is located.\n 2. Send Email to Vendor \nUse this email template:\nSubject: Trash Valet Setup – [Full Property Address]\nBody:\nHi, [Vendor Name],\n\nWe have a new property that we need to set up trash valet for. The address is [Full Property Address].\n\nCan you please confirm the monthly price and the days you will be going to the property? The trash day is [linked here].\n\nThank you,\n[Your Name]\n\n3. Update Breezeway Profile Tags \n Go to the property profile in Breezeway.\n Under Profile Details → Tags:\n Add: Trash Valet – [Vendor Name]\n Remove: New House - Currently Inactive",
    blocksHandoff: true,
    breezewayTemplateId: "135933",
    sortOrder: 1190,
  },
  {
    key: "phase5_monitor_review_the_standard_inspection_results",
    stage: "phase5_monitor",
    title: "Review the Standard Inspection Results",
    role: "Project Manager",
    detail:
      'Review the results:\n Open the Standard Inspection results on this task in Resolve.\n Evaluate and follow up:\n Read through all information provided. If any items raise concerns, follow up accordingly.\n Make adjustments if needed:\n If any information needs to be corrected or updated, use “Adjust responses” on this task in Resolve to revise any necessary details.\n Store finalized results:\n The onboarding manager will add these items to the PID once they have heard that you have reviewed these results.',
    blocksHandoff: true,
    evidenceRequired: true,
    sortOrder: 1200,
  },
  {
    key: "phase5_monitor_add_property_to_truvi",
    stage: "phase5_monitor",
    title: "Add property to Truvi",
    role: "Onboarding Admin",
    detail:
      "Using this link, set up the property as a listing. Include the internal property name & address. Once completed, add the option, “$25 /per booking” as the program option. \n\nhttps://app.knowyourguest.io/programs?pageNumber=1&pageSize=10&searchString=",
    blocksHandoff: true,
    sortOrder: 1210,
  },
  {
    key: "phase5_monitor_assign_a_default_cleaner",
    stage: "phase5_monitor",
    title: "Assign a Default Cleaner",
    role: "Project Manager",
    detail:
      "🔍 How to Assign a Cleaning Vendor Step 1: Find the Head Cleaner \n Open the Resolve vendor directory and filter by market.\n Locate the appropriate market and find the “Head Cleaner” listed.\n This is the cleaner you will assign in Breezeway.\n \n Step 2: Assign the Cleaner in Breezeway \n Open Breezeway and click on the property you’re working with.\n In the left-hand menu, click the “Profile” tab.\n At the top, select the “Details” tab.\n Scroll to the “Property Tags” section and select the appropriate cleaning tag based on the market:\n OKC Metro Cleanings\n Tulsa Cleanings\n DFW Cleanings\n Indy Cleanings\n Still on the same property, click the “Template Modifiers” tab on the left menu.\n Under the automatically opened “People” tab, go to the “Department Defaults” section.\n Click the ➕ plus sign and …",
    blocksHandoff: true,
    sortOrder: 1220,
  },
  {
    key: "phase5_monitor_complete_the_mid_project_review_form",
    stage: "phase5_monitor",
    title: "Complete the Mid Project Review Form",
    role: "Project Manager",
    detail:
      "Complete the Mid-Project Review directly in Resolve, on this task.\n\nWhat to do:\n1. Appliances must be installed before this task can be completed. Photograph the appliance labels (make, model, serial) on site.\n2. Attach the appliance-label photos and any updated property photos to this task as evidence.\n3. Update the property record in Resolve (Property Hub \u2192 Property details) with anything that has changed \u2014 systems, access, utilities, amenities.\n4. Mark this task complete. Resolve records who reviewed it and when; no separate form is needed.\n\nResolve is the record for this review.",
    blocksHandoff: true,
    sortOrder: 1230,
  },
  {
    key: "phase6_handoff_review_invoices",
    stage: "phase6_handoff",
    title: "Review Invoices",
    role: "Onboarding Manager",
    detail:
      'Please update the "Invoice Status" as necessary on the Active Projects page.\n\nAt this point the first two invoices should be sent, or the second will be sent soon.',
    blocksHandoff: false, // financial closeout — tracked after operational handoff,
    sortOrder: 1240,
  },
  {
    key: "phase6_handoff_request_staging_team_provide_photos_of_unused",
    stage: "phase6_handoff",
    title: "Request staging team provide photos of unused decor",
    role: "Project Manager",
    detail:
      "Instructions:\n1.) Please attempt to return any unused décor or extra items delivered to the home.\n2.) If items cannot be returned or could be used at another property, please let the onboarding manager know so they can be allocated accordingly.",
    blocksHandoff: true,
    sortOrder: 1250,
  },
  {
    key: "phase6_handoff_setup_property_profile_in_breezeway",
    stage: "phase6_handoff",
    title: "Setup Property Profile in Breezeway",
    role: "Project Manager",
    blocksHandoff: true,
    subtasks: ["Cleaning tag", "Default cleaner", "Default lawn care", "Assign to property group"],
    sortOrder: 1260,
  },
  {
    key: "phase6_handoff_ensure_all_work_orders_are_reviewed_approved_",
    stage: "phase6_handoff",
    title: "Ensure all work orders are reviewed/approved in Breezeway",
    role: "Project Manager",
    blocksHandoff: true,
    sortOrder: 1270,
  },
  {
    key: "phase6_handoff_send_micah_a_message_to_confirm_the_property_",
    stage: "phase6_handoff",
    title: "Send Micah a message to confirm the property is synced to Airbnb/VRBO",
    role: "Project Manager",
    blocksHandoff: true,
    sortOrder: 1280,
  },
  {
    key: "phase6_handoff_hoa_guidelines_check_trash_cans",
    stage: "phase6_handoff",
    title: "HOA Guidelines Check – Trash Cans",
    role: "Project Manager",
    detail:
      "Review the HOA documents to confirm whether any guidelines exist regarding trash can placement and storage.\n\nIf a trash valet is needed, reach out to the utilities coordinator to schedule a weekly trash service route.",
    blocksHandoff: true,
    sortOrder: 1290,
  },
  {
    key: "phase6_handoff_adjust_the_new_house_prep_blocking_in_owner_r",
    stage: "phase6_handoff",
    title: "Adjust the New House Prep blocking in Owner Rez, if necessary",
    role: "Project Manager",
    blocksHandoff: true,
    sortOrder: 1300,
  },
  {
    key: "phase6_handoff_update_breezeway_items",
    stage: "phase6_handoff",
    title: "Update Breezeway Items",
    role: "Project Manager",
    detail:
      "See below subtasks. \n\nUpdate Department defaults and Task templated within the Template modifiers on the left panel.",
    blocksHandoff: true,
    subtasks: [
      "Default Cleaner",
      "Recurring Lawn Care",
      "Quality and Arrival Inspection Vendor (Only when in OKC. Will be assigned to Elizabeth)",
    ],
    sortOrder: 1310,
  },
  {
    key: "phase6_handoff_property_location_verification",
    stage: "phase6_handoff",
    title: "Property Location Verification",
    role: "Project Manager",
    detail:
      "If the home is a new build, please verify that the property is accurately mapped on Google and Apple Maps. If it is not, add detailed directions to the Breezeway profile.\n\nAdditionally, ensure that the correct coordinates are included in both the Breezeway profile and OwnerRez.\n\nFor reference, see the property profile for 16216 Whistle Creek Blvd in Breezeway: https://app.breezeway.io/property/492827/profile.",
    blocksHandoff: true,
    evidenceRequired: true,
    sortOrder: 1320,
  },
  {
    key: "phase6_handoff_confirm_completion_of_photo_shoot_purchase_ph",
    stage: "phase6_handoff",
    title: "Confirm completion of photo shoot, purchase photos and download to OneDrive",
    role: "Project Manager",
    detail:
      "Instructions:\n\n Check photography website to confirm completion of photos.\n Review photos and purchase them; the purchasing steps are in the Resolve playbook library. \n Download from the website to the property's OneDrive folder",
    blocksHandoff: true,
    evidenceRequired: true,
    sortOrder: 1330,
  },
  {
    key: "phase6_handoff_follow_up_on_pricelabs_connection_sales_tax_s",
    stage: "phase6_handoff",
    title: "Follow-Up on PriceLabs Connection & Sales Tax Setup",
    role: "Project Manager",
    detail:
      "Please email Kade & James to confirm the following items have been completed for the property:\n PriceLabs & the base price recorded in Resolve have been successfully connected and synced.\n Sales tax has been set up correctly for the property in all applicable platforms.\n\nTemplate: \nHey team,\n\nJust wanted to check in real quick — [Property Address] will be handed off to operations in the next day or so, and I wanted to make sure we’re all set up before that happens.\n Can someone get PriceLabs and the base price in Resolve connected and synced for this property?\n Kade, could you help get the sales tax set up on all the applicable platforms when you get a chance?\nLet me know if you have any questions, and just shoot me a quick confirmation once everything’s done. Appreciate you all — thanks so much!",
    blocksHandoff: true,
    sortOrder: 1340,
  },
  {
    key: "phase6_handoff_upload_photos_and_home_marketing_content_to_m",
    stage: "phase6_handoff",
    title: "Upload photos and home marketing content to marketing sites via OwnerRez",
    role: "Project Manager",
    detail:
      "Instructions: \n1.) Download both the print and online photos from the photographer's website to a zip file.\n\n2.) Save the files to OneDrive.\n\n3.) Upload the online photos to the property profile in OwnerRez in the following order:\n The cover photo should be a high-quality photo of the main living area\n Exterior front of the home\n Entryway decor\n Living area\n Kitchen\n Dining area\n Master bedroom\n Master bathroom\n Guest bedrooms and guest baths\n Bonus rooms/office space/secondary living areas\n Laundry room/mudroom\n Back patio\n Backyard\n Any photos of the neighborhood amenities\n\n4.) Add captions with the room name to all photos. \n\n5.) Update the property profile information in OwnerRez including descriptions, accommodations, guest instructions, etc using the attached tutorial in the Resolve playbook library: …",
    blocksHandoff: true,
    subtasks: ["Review descriptions in OwnerRez before handoff"],
    sortOrder: 1350,
  },
  {
    key: "phase6_handoff_activate_the_1_year_subscription_for_property",
    stage: "phase6_handoff",
    title: "Activate the 1-year subscription for property Ring devices & check connectivity",
    role: "Project Manager",
    blocksHandoff: true,
    sortOrder: 1360,
  },
  {
    key: "phase6_handoff_set_up_breezeway_yale_integration",
    stage: "phase6_handoff",
    title: "Set up Breezeway/Yale Integration",
    role: "Project Manager",
    blocksHandoff: true,
    subtasks: ["Update the Property Hub (PID) in Resolve"],
    sortOrder: 1370,
  },
  {
    key: "phase6_handoff_review_the_final_inspection_results",
    stage: "phase6_handoff",
    title: "Review the Final Inspection Results",
    role: "Project Manager",
    detail:
      'Review the results:\n Open the Final Inspection results on this task in Resolve.\n Evaluate and follow up:\n Read through all information provided. If any items raise concerns, follow up accordingly.\n Make adjustments if needed:\n If any information needs to be corrected or updated, use “Adjust responses” on this task in Resolve to revise any necessary details.\n Store finalized results:\n The onboarding manager will add these items to the PID once they have heard that you have reviewed these results.',
    blocksHandoff: true,
    evidenceRequired: true,
    sortOrder: 1380,
  },
  {
    key: "phase6_handoff_provide_final_cost_for_repairs_flooring_paint",
    stage: "phase6_handoff",
    title:
      "Provide final cost for repairs, flooring, painting and landscaping to Accounting Team for owner invoice",
    role: "Project Manager",
    detail:
      'Adjust the Repair & Improvement Report in Smartsheet. \n Send the Smartsheet link (and Houzz Pro estimate for customer if necessary) to the onboarding manager mentioning any discrepancies. \n The Project Manager should compose a final update to the owner when sending the "Your Home Is Ready for Booking" email. Please provide an explanation of overages to avoid confusion between accounting and the project manager.',
    blocksHandoff: false, // financial closeout — tracked after operational handoff,
    sortOrder: 1390,
  },
  {
    key: "phase6_handoff_send_your_home_is_ready_for_booking_email_and",
    stage: "phase6_handoff",
    title: 'Send "Your Home Is Ready for Booking" email and provide photos link to Owner',
    role: "Project Manager",
    detail:
      'Instructions:\n After the final walkthrough has been completed, and marketing photos have been uploaded, notify the owner that their home is now ready for booking and provide them with the link to their photos on our website.\n BE SURE TO MODIFY THE LANGUAGE IN THE BELOW SAMPLE TO FIT YOUR PROPERTY.\n Feel free to provide additional information as appropriate (for instance, see below for an example of reshoots scheduled for the home and small, outstanding items that need to be done). Assure the owner that these tasks will not prevent their home from being marketed for booking.\n CC the Onboarding Manager, CEO and Property Manager on the correspondence\n\nSample Email:\nGood Morning, Owner!\n \nI wanted to let you know that your new home is now ready and "Open for Business."\n \nPlease see the link to your home on our website …',
    blocksHandoff: true,
    sortOrder: 1400,
  },
  {
    key: "phase6_handoff_complete_new_house_handoff_form_before_handof",
    stage: "phase6_handoff",
    title: "Complete New House Handoff form before Handoff Meeting",
    role: "Project Manager",
    detail:
      "Raise the handoff in Resolve, not in outside spreadsheets or forms.\n\nWhat to do:\n1. Open the property in Resolve and request handoff from the Onboarding workspace.\n2. The request routes natively: Director of Onboarding review \u2192 Director of Operations review \u2192 Operations acceptance \u2192 live confirmation.\n3. A handoff is not complete until Operations accepts it. Until then the property stays with Onboarding.\n\nThere is no external handoff form. Resolve holds the single handoff record.",
    blocksHandoff: true,
    evidenceRequired: true,
    sortOrder: 1410,
  },
  {
    key: "phase6_handoff_schedule_the_handoff_meeting",
    stage: "phase6_handoff",
    title: "Schedule the Handoff Meeting",
    role: "Project Manager",
    detail:
      "Instructions:\n Please schedule the handoff meeting with Micah & Kati. Please send the link to the handoff form, this must be completed before meeting. \n The purpose of the meeting is to review the Home Handoff Form and discuss any outstanding items that still need to be completed on the property (any outstanding repairs, installation of blinds, inventory that hasn't arrived, etc.)\n Please ensure all invoices have been reviewed and approved to invoice.",
    blocksHandoff: true,
    sortOrder: 1420,
  },
  {
    key: "phase6_handoff_notify_ceo_and_onboarding_manager_of_handoff_",
    stage: "phase6_handoff",
    title: "Notify CEO and Onboarding Manager of handoff completion",
    role: "Project Manager",
    detail:
      "Instructions:\nOnce the handoff meeting has been conducted, send email notification to the CEO and Onboarding Manager that the meeting has been completed.",
    blocksHandoff: true,
    sortOrder: 1430,
  },
  {
    key: "phase6_handoff_move_property_to_pending_cost_review_on_the_a",
    stage: "phase6_handoff",
    title: 'Move property to "Pending Cost Review" on the Active Projects page',
    role: "Onboarding Manager",
    blocksHandoff: false, // financial closeout — tracked after operational handoff,
    sortOrder: 1440,
  },
  {
    key: "phase6_handoff_send_managing_your_home_e_mail_to_owner_reque",
    stage: "phase6_handoff",
    title: 'Send "Managing Your Home" e-mail to owner & request owner portal link sent',
    role: "Onboarding Manager",
    detail:
      "Instructions:\n Send the https://arealhomeaway-my.sharepoint.com/:w:/p/info/ETscUVJDLvdEgfv1AOntL3EBrZVUeHw0Xy03NDNl20Gunw?e=LcaQRb e-mail to the owner to inform them of what they can expect as ARHA conducts regular property management. Modify the template as necessary, based on the owner's utilities payment election on the property PMA.\n Send an email to Operations team member (Kade), requesting the owner portal link be sent to the owner. Also request that you be advised once this has been done.",
    blocksHandoff: true,
    sortOrder: 1450,
  },
  {
    key: "phase6_handoff_send_post_handoff_tasks_reminder_to_micah",
    stage: "phase6_handoff",
    title: "Send Post-Handoff Tasks Reminder to Micah",
    role: "Onboarding Manager",
    blocksHandoff: true,
    sortOrder: 1460,
  },
  {
    key: "phase6_handoff_confirm_portal_link_has_been_sent_to_the_owne",
    stage: "phase6_handoff",
    title: "Confirm portal link has been sent to the owner",
    role: "Onboarding Manager",
    detail:
      "Instructions:\n Request Kade send the OwnerRez portal link to the new owner and advise once this has been done.\n Complete this task once confirmation of the portal link being sent is received.",
    blocksHandoff: true,
    sortOrder: 1470,
  },
  {
    key: "phase6_handoff_remind_the_accounting_team_to_apply_for_short",
    stage: "phase6_handoff",
    title: "Remind the Accounting team to apply for short-term rental (if needed)",
    role: "Onboarding Manager",
    blocksHandoff: true,
    sortOrder: 1480,
  },
  {
    key: "phase6_handoff_update_project_status",
    stage: "phase6_handoff",
    title: "Update project status",
    role: "Project Manager",
    detail:
      "Update the project status on this home in Resolve and note anything the team needs to be aware of.",
    blocksHandoff: false,
    sortOrder: 1490,
  },
  {
    key: "phase6_handoff_final_review_property_costs",
    stage: "phase6_handoff",
    title: "Final Review - Property Costs",
    role: "Onboarding Manager",
    detail:
      "Complete the entry on this task in Resolve.",
    blocksHandoff: false, // financial closeout — tracked after operational handoff,
    sortOrder: 1500,
  },
];

/**
 * The Master Onboarding sequence as template rows: the 26 control steps, in
 * order, each in its operational stage and owned by its default role. These
 * are the spine of every onboarding project; the Full Furnishing rows above
 * are the execution work carried out underneath them.
 */
function masterStepDetail(step: MasterStep) {
  const lines = [`Step ${step.number} of 26 — ${step.who}.`];
  if (step.gate) {
    lines.push(
      "This is an authority gate. It is passed by the named role only — the assigned Project Manager cannot approve their own handoff.",
    );
  }
  if (step.number === 19) lines.push(MASTER_SEQUENCE_RULES[4]);
  if (step.number === 22 || step.number === 23) {
    lines.push(MASTER_SEQUENCE_RULES[3], MASTER_SEQUENCE_RULES[5]);
  }
  return lines.join("\n\n");
}

export const MASTER_SEQUENCE_TEMPLATE: TemplateTask[] = MASTER_STEPS.map((step) => ({
  key: step.key,
  stage: step.stage,
  title: `${step.number}. ${step.title}`,
  role: onboardingRole(step.roles[0]!).title,
  detail: masterStepDetail(step),
  blocksHandoff: step.blocksHandoff,
  ...(step.requiresOwnerApproval ? { requiresOwnerApproval: true } : {}),
  ...(step.evidenceRequired ? { evidenceRequired: true } : {}),
  sortOrder: step.number * 10,
}));

/**
 * What Resolve applies to a property: the 26-step master sequence first, then
 * the detailed Full Furnishing plan.
 */
/**
 * The detailed Full Furnishing work, filed under the eight operational
 * stages. Nothing about a task changes except the heading it sits under —
 * title, detail, role, anchor, order, approvals and evidence are untouched,
 * and `legacyStage` keeps a record of where it used to live.
 */
export const STAGED_FULL_FURNISHING_TEMPLATE: TemplateTask[] = FULL_FURNISHING_TEMPLATE.map(
  (task) => {
    const stage = masterStageForLegacyTask(task.stage, task.title);
    return stage ? { ...task, stage, legacyStage: task.stage } : task;
  },
);

export const MASTER_ONBOARDING_TEMPLATE: TemplateTask[] = [
  ...MASTER_SEQUENCE_TEMPLATE,
  ...STAGED_FULL_FURNISHING_TEMPLATE,
];

export const TEMPLATE_KEY = "arha_master_onboarding_v1";

export function templateCounts() {
  return {
    masterSteps: MASTER_SEQUENCE_TEMPLATE.length,
    tasks: MASTER_ONBOARDING_TEMPLATE.length,
    subtasks: MASTER_ONBOARDING_TEMPLATE.reduce((n, t) => n + (t.subtasks?.length ?? 0), 0),
    scheduled: MASTER_ONBOARDING_TEMPLATE.filter((t) => t.anchor).length,
    ownerApprovals: MASTER_ONBOARDING_TEMPLATE.filter((t) => t.requiresOwnerApproval).length,
    evidence: MASTER_ONBOARDING_TEMPLATE.filter((t) => t.evidenceRequired).length,
    workOrders: MASTER_ONBOARDING_TEMPLATE.filter((t) => t.breezewayTemplateId).length,
  };
}
