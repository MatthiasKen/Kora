import Link from "next/link";
export const metadata = { title: "Privacy" };
export default function Privacy() {
  return (
    <article className="page-width policy-page">
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Privacy</span>
      </div>
      <p className="eyebrow">YOUR INFORMATION, HANDLED WITH CARE</p>
      <h1>A little clarity about privacy.</h1>
      <p>
        We use the information you share to make shopping, delivery, and order
        management work.
      </p>
      <h2>What the store uses</h2>
      <ul>
        <li>
          Your Google name, verified email address and profile image when you
          sign in.
        </li>
        <li>
          The name, delivery address, phone number, email and notes you provide
          at checkout.
        </li>
        <li>
          Shopping bag contents, order items, payment references and payment
          status.
        </li>
      </ul>
      <h2>How it is used</h2>
      <p>
        Account and order information is stored in the store's database.
        Delivery details are used for your order. Your email address is used to
        send a receipt. Paystack processes payment details; the store does not
        store card numbers or card security codes. Mailgun delivers
        transactional order emails.
      </p>
      <h2>Your browser</h2>
      <p>
        Essential cookies support sign-in, guest shopping bags and receipt
        access. Browser storage keeps guest bag selections and saved favourites.
        Live account bags stay in the database and appear only when that account
        is signed in. In demo mode, sample accounts, bags and orders stay in your
        browser. Demo orders take no payment and send no email. The store owner
        can separately send an explicit sample email through the email-test tool.
      </p>
      <h2>Your choices</h2>
      <p>
        You can shop as a guest, remove items from your bag, clear saved
        favourites, and sign out at any time. Clearing your browser's site data
        removes locally saved demo information. For live account or order
        information, contact the merchant through their published support
        channel.
      </p>
    </article>
  );
}
