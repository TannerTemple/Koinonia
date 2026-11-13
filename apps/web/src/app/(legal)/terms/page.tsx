import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, Contact, LegalSection, LegalTitle } from "@/components/legal";
import { CONTACT_EMAIL, GOVERNING_LAW, LAST_UPDATED, OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The agreement between you and the people who run Koinonia.",
};

export default function TermsPage() {
  return (
    <>
      <LegalTitle title="Terms of Use" updated={LAST_UPDATED}>
        <p>
          These terms are the agreement between you and {OPERATOR} (&ldquo;we&rdquo;), who runs Koinonia. By creating an account or using Koinonia you agree to them. If you do not agree, please
          do not use it.
        </p>
      </LegalTitle>

      <LegalSection id="service" title="1. What Koinonia is">
        <p>
          Koinonia is a personal tool for remembering to reach out to people, keeping notes about them, and keeping a prayer list. It is available as a website and an iPhone app. It is free.
        </p>
      </LegalSection>

      <LegalSection id="account" title="2. Your account">
        <Bullets>
          <li>You must be at least 13 years old (or 16 where local law sets that age) to use Koinonia.</li>
          <li>Give a real email address you control. It is the only way to reset your password.</li>
          <li>Keep your password to yourself. You are responsible for what happens under your account; tell us promptly if you think someone else has used it.</li>
          <li>One person per account. Accounts are for personal use, not for running a business or mailing list.</li>
        </Bullets>
      </LegalSection>

      <LegalSection id="content" title="3. What you put in">
        <p>
          Your people, notes, reach-out history and prayer intentions are yours. You give us permission to store them and show them back to you on your devices, and to send you the reminders you
          have switched on. We claim no other rights over them, and we do not share them, as the <Link href="/privacy" className="font-semibold text-primary underline underline-offset-2">Privacy Policy</Link> explains.
        </p>
        <p>You are responsible for what you store. Please do not use Koinonia to store:</p>
        <Bullets>
          <li>anything unlawful, or anything you have no right to keep;</li>
          <li>passwords, payment card numbers, government ID numbers, or medical records;</li>
          <li>information about other people gathered to harass, stalk, or harm them.</li>
        </Bullets>
      </LegalSection>

      <LegalSection id="others" title="4. Other people's information">
        <p>
          Koinonia works by letting you record things about people you know. Only add people you have a real relationship with, and only record what you would be comfortable with them knowing
          you had written. When you import contacts, you confirm that you are allowed to store those people&rsquo;s details for your own personal use. If someone asks you to remove what you have
          stored about them, please do.
        </p>
      </LegalSection>

      <LegalSection id="conduct" title="5. Fair use">
        <p>Do not:</p>
        <Bullets>
          <li>try to get into someone else&rsquo;s account or data;</li>
          <li>use the member search to collect names, emails or phone numbers, or to contact people who do not know you;</li>
          <li>probe, overload or disrupt the service, or get around its limits;</li>
          <li>use automated tools to create accounts or copy data in bulk;</li>
          <li>pretend to be someone else.</li>
        </Bullets>
      </LegalSection>

      <LegalSection id="reminders" title="6. Reminders, prayer and good sense">
        <p>
          Reminders are a help, not a guarantee. Notifications and emails can be delayed, blocked or missed for reasons outside our control, so do not rely on Koinonia for anything where a
          missed reminder would cause harm.
        </p>
        <p>
          Koinonia is not a counselling, medical, emergency or pastoral service, and nothing in it is professional advice. If you or someone you know is in danger, contact your local emergency
          services.
        </p>
      </LegalSection>

      <LegalSection id="ending" title="7. Leaving, and closing accounts">
        <p>
          You can stop using Koinonia and delete your account at any time from Settings (web) or Profile (iPhone). Deletion is permanent and removes everything in the account; the Privacy Policy
          describes it in detail.
        </p>
        <p>
          We may suspend or close an account that breaks these terms or puts other people or the service at risk. Where we reasonably can, we will tell you first and give you a chance to put it
          right. We may also stop offering Koinonia altogether; if we do, we will give at least 30 days&rsquo; notice by email or in the app so you can copy out what you need.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="8. Changes to the service and to these terms">
        <p>
          We may add, change or remove features. If we change these terms in a way that matters, we will tell you in the app or by email before the change takes effect. If you keep using
          Koinonia after that, you accept the new terms; if you do not accept them, you can delete your account.
        </p>
      </LegalSection>

      <LegalSection id="warranty" title="9. No warranty">
        <p>
          Koinonia is provided free of charge and &ldquo;as is&rdquo;. We work to keep it running, secure and correct, but we do not promise that it will always be available, free of errors,
          or that data will never be lost. Keep your own copy of anything you could not bear to lose.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="10. Limit of liability">
        <p>
          To the fullest extent the law allows, we are not liable for indirect or consequential losses, lost data, or losses arising from a missed or late reminder, and our total liability to you
          for any claim relating to Koinonia is limited to [LIABILITY CAP, e.g. 50 US dollars]. Nothing in these terms limits liability that cannot be limited by law, or takes away rights you
          have as a consumer where you live.
        </p>
      </LegalSection>

      <LegalSection id="apple" title="11. If you got the app from Apple's App Store">
        <p>
          These terms are between you and us, not Apple. Apple is not responsible for Koinonia or its content, has no obligation to provide maintenance or support for it, and is not responsible
          for any claims relating to it. Apple and its subsidiaries are third-party beneficiaries of these terms and may enforce them against you. Your use of the app must also follow the App
          Store&rsquo;s own terms.
        </p>
      </LegalSection>

      <LegalSection id="law" title="12. Governing law">
        <p>
          These terms are governed by the laws of {GOVERNING_LAW}, without affecting any mandatory protections of the country where you live. If part of these terms turns out to be
          unenforceable, the rest still applies.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="13. Contact">
        <p>
          {OPERATOR}
          <br />
          <Contact email={CONTACT_EMAIL} />
        </p>
      </LegalSection>
    </>
  );
}
