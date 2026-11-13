import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, Contact, LegalSection, LegalTitle } from "@/components/legal";
import { BACKUP_RETENTION, CONTACT_EMAIL, LAST_UPDATED, OPERATOR, PROCESSORS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Koinonia stores about you and the people you add, who can see it, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <>
      <LegalTitle title="Privacy Policy" updated={LAST_UPDATED}>
        <p>
          Koinonia helps you stay in touch with people and pray for them. To do that it stores things you would not want strangers to read: who matters to you, what you note about them, and what
          you pray for. This page says exactly what is stored, who can see it, and how to remove it.
        </p>
        <p>
          Koinonia is run by {OPERATOR} (&ldquo;we&rdquo;). Questions and requests: <Contact email={CONTACT_EMAIL} />.
        </p>
      </LegalTitle>

      <LegalSection id="short" title="The short version">
        <Bullets>
          <li>We store what you type in, so the app can show it back to you and remind you. Nothing more.</li>
          <li>We do not sell your information, show ads, or track you across other apps or websites. There is no analytics or advertising code in Koinonia.</li>
          <li>Your notes, your prayer intentions and your list of people are visible only to you inside the app.</li>
          <li>You can delete your account, and everything in it, yourself at any time.</li>
        </Bullets>
      </LegalSection>

      <LegalSection id="what" title="What we store">
        <h3 className="text-lg font-semibold">About you</h3>
        <Bullets>
          <li>
            <strong>Account details:</strong> your name, email address, phone number if you give one, and your timezone.
          </li>
          <li>
            <strong>Your password,</strong> only as a one-way scrambled value (a salted scrypt hash). We cannot read it.
          </li>
          <li>
            <strong>Sign-in records:</strong> when you signed in and were last active, so sessions can expire and be revoked. Failed sign-in attempts are counted per email address for 15 minutes to
            block password guessing.
          </li>
          <li>
            <strong>Settings:</strong> whether other members can find you, and whether you want the daily reminder.
          </li>
          <li>
            <strong>A push notification token</strong> for your phone, if you turn notifications on. It is removed when you sign out.
          </li>
        </Bullets>

        <h3 className="text-lg font-semibold">About the people you add</h3>
        <p>
          For each person you choose to keep up with: their name and, if you enter them, their phone number, email address, how you know them, their birthday, and how often you want to be
          reminded. Koinonia also records each time you say you reached out (the day, how, and any summary you write).
        </p>
        <p>
          <strong>Importing contacts.</strong> On iPhone, Koinonia reads your address book only after you allow it and only while you are on the import screen. The list is shown on your phone, and
          only the people you tick are sent to our server. Your address book is never uploaded as a whole. On the web, a contacts file you choose is read in your browser and, again, only the
          people you tick are sent.
        </p>

        <h3 className="text-lg font-semibold">Notes</h3>
        <p>The notes you write about a person, and any follow-up date you set on them.</p>

        <h3 className="text-lg font-semibold">Prayer intentions</h3>
        <p>
          The intentions you add (a title, optional details, and the person it is for, if any), the days you marked them as prayed, and which one was set apart each day. Prayer intentions can
          reveal your religious beliefs and private facts about you and other people, such as someone&rsquo;s illness. We treat them as sensitive: they are never shown to other members, never
          used for anything except showing them to you, and never included in push notifications. If you turn on the daily reminder email, that email includes the title of the day&rsquo;s
          intention; turn the reminder off in Settings if you would rather it did not.
        </p>

        <h3 className="text-lg font-semibold">Technical records</h3>
        <p>
          Our server keeps a short technical log of requests: the time, the address of the page requested (without search terms), the response code, and your IP address. It does not log what you
          type, your notes, your intentions, or email contents. Logs are kept by our hosting provider for a limited time and are used only to keep the service running and secure.
        </p>
      </LegalSection>

      <LegalSection id="not" title="What we do not collect">
        <Bullets>
          <li>Your location.</li>
          <li>Your whole address book, your messages, your call history, or the content of any call, text or email you make from the app. The call, text and email buttons simply open your phone&rsquo;s own apps.</li>
          <li>Advertising identifiers, or any data for tracking you across other companies&rsquo; apps and websites.</li>
          <li>Payment details. Koinonia is free.</li>
        </Bullets>
      </LegalSection>

      <LegalSection id="use" title="How we use it">
        <Bullets>
          <li>To show you your people, notes, history and prayer list on your devices.</li>
          <li>
            To work out who is due and remind you: on the Today screen, by notifications on your phone, and by a daily email if you leave that on. Reminder notifications name the people who are
            due, and a follow-up reminder shows the start of the note you wrote, so they may be visible on your lock screen depending on your phone&rsquo;s settings.
          </li>
          <li>To send account emails: confirming your address and resetting your password.</li>
          <li>To keep the service secure, for example limiting repeated sign-in attempts.</li>
        </Bullets>
        <p>We do not use your information to train artificial intelligence, to build advertising profiles, or for any purpose not listed here.</p>
        <p>
          Where the law asks for a legal basis (for example in the EU and UK): we process your account and content to provide the service you asked for; we rely on your consent for push
          notifications, for reading your address book, and for the sensitive information you choose to write in prayer intentions and notes; and we rely on our legitimate interest in keeping
          the service secure. You can withdraw consent at any time by turning the feature off or deleting the content.
        </p>
      </LegalSection>

      <LegalSection id="who" title="Who can see it">
        <Bullets>
          <li>
            <strong>You.</strong> Everything in your account is private to your account.
          </li>
          <li>
            <strong>Other members, in one limited way.</strong> Someone signed in to Koinonia can look you up by typing the start of your name, your exact email address, or your exact phone
            number, and will see your name so they can add you to their own list. They never see your people, notes, intentions or activity, and a search by name does not reveal your email or
            phone. Turn this off in Settings under &ldquo;Let friends find me&rdquo;.
          </li>
          <li>
            <strong>Administrators</strong> of this Koinonia service can see a list of accounts (name, email, phone number if given, when last active, and how many people and intentions each has) and can disable an
            account. The admin screens do not show the content of anyone&rsquo;s notes, people or intentions.
          </li>
          <li>
            <strong>Companies that run the service for us.</strong> They hold the data on our behalf and may not use it for their own purposes:
            <Bullets>
              {PROCESSORS.map((p) => (
                <li key={p.name}>
                  {p.name}: {p.purpose}.
                </li>
              ))}
            </Bullets>
          </li>
          <li>
            <strong>Authorities,</strong> only if the law requires it.
          </li>
        </Bullets>
        <p>
          Koinonia is not end-to-end encrypted. Information is encrypted while it travels between your device and our server, and stored in our database, where the people who operate the
          service could technically access it. We do not look at your content except when you ask us for help or when the law requires it.
        </p>
      </LegalSection>

      <LegalSection id="others" title="Information about other people">
        <p>
          Much of what you put into Koinonia is about someone else: a friend&rsquo;s phone number, a note about their new job, a prayer for their health. You decide what to record, and you are
          responsible for having a good reason to keep it. Please record only what you would be comfortable with that person knowing you had written down.
        </p>
        <p>
          If you believe someone has stored information about you in Koinonia and you want it removed, write to <Contact email={CONTACT_EMAIL} />. We will work with the account holder, or
          remove it ourselves where the law requires.
        </p>
      </LegalSection>

      <LegalSection id="delete" title="Deleting your account and your data">
        <p>You can remove things yourself, and removal is immediate:</p>
        <Bullets>
          <li>
            <strong>One item:</strong> delete any person, note, reach-out or intention from its own screen. Deleting a person also deletes their notes and history, and unlinks their intentions.
          </li>
          <li>
            <strong>Everything:</strong> on the web go to Settings, then &ldquo;Delete my account&rdquo;; in the iPhone app go to Profile, then &ldquo;Delete my account&rdquo;. You will be asked
            for your password. This permanently deletes your account and all of your people, notes, reach-out history, prayer intentions, prayer history, sessions, push tokens and calendar link.
            It cannot be undone, and we cannot restore it for you.
          </li>
          <li>
            <strong>Can&rsquo;t sign in?</strong> Email <Contact email={CONTACT_EMAIL} /> from the address on the account and we will delete it for you.
          </li>
        </Bullets>
        <p>
          Deleted data is removed from the live database at once. Copies may remain in our database provider&rsquo;s backups for up to {BACKUP_RETENTION} before they are overwritten; they are
          not used for anything in the meantime. Technical logs expire on our hosting provider&rsquo;s schedule.
        </p>
        <p>We keep your data for as long as your account exists. If you simply stop using Koinonia, your data stays until you delete it or ask us to.</p>
      </LegalSection>

      <LegalSection id="rights" title="Your choices and rights">
        <Bullets>
          <li>
            <strong>See and correct</strong> your information in the app at any time.
          </li>
          <li>
            <strong>Get a copy.</strong> There is no export button yet; email us and we will send you your data in a common format.
          </li>
          <li>
            <strong>Delete</strong> it, as described above.
          </li>
          <li>
            <strong>Turn off</strong> the daily email, push notifications, being findable by other members, and the calendar link, each in Settings or Profile.
          </li>
          <li>
            <strong>Object or complain.</strong> Depending on where you live (for example the EU, the UK, or California) you may have further rights, including to object to processing and to
            complain to your data protection authority. We will not treat you differently for using any of these rights.
          </li>
        </Bullets>
        <p>
          To use any of these, write to <Contact email={CONTACT_EMAIL} />. We will answer within 30 days.
        </p>
      </LegalSection>

      <LegalSection id="security" title="How we protect it">
        <Bullets>
          <li>Connections to Koinonia are encrypted (HTTPS).</li>
          <li>Passwords are stored only as salted one-way hashes. Sign-in tokens, password reset links and the calendar link are stored only as hashes too.</li>
          <li>On the web, your session is kept in a cookie that page scripts cannot read. On iPhone it is kept in the system Keychain.</li>
          <li>Every request is checked so that an account can only read and change its own data.</li>
        </Bullets>
        <p>No system is perfectly secure. If we learn of a breach that affects your information, we will tell you and the authorities as the law requires.</p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies and storage on your device">
        <p>
          The web app sets one cookie, <code>koinonia_session</code>, which keeps you signed in. It is essential, it is not used for tracking, and it is removed when you sign out. Your choice of
          light or dark theme is saved in your browser. The iPhone app stores your sign-in token in the Keychain and schedules reminder notifications on the phone itself. We use no advertising
          or analytics cookies.
        </p>
      </LegalSection>

      <LegalSection id="children" title="Children">
        <p>
          Koinonia is not meant for children under 13 (or under 16 where local law sets that age), and we do not knowingly collect their information. If you believe a child has created an
          account, tell us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection id="where" title="Where data is kept">
        <p>
          Koinonia&rsquo;s server and database are located in [HOSTING REGION]. If you use Koinonia from another country, your information is transferred to and stored there. Where the law
          requires safeguards for such transfers, we rely on [TRANSFER MECHANISM, e.g. standard contractual clauses offered by our providers].
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <p>
          If we change this policy in a way that matters, we will say so in the app or by email before the change takes effect, and update the date at the top. The current version is always at
          this address.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          {OPERATOR}
          <br />
          <Contact email={CONTACT_EMAIL} />
        </p>
        <p>
          See also the <Link href="/terms" className="font-semibold text-primary underline underline-offset-2">Terms of Use</Link>.
        </p>
      </LegalSection>
    </>
  );
}
