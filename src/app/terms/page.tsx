import Link from "next/link";
export const metadata = { title: "Shopping terms" };
export default function Terms() {
  return (
    <article className="page-width policy-page">
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Shopping terms</span>
      </div>
      <p className="eyebrow">GOOD FINDS, CLEAR EXPECTATIONS</p>
      <h1>A thoughtful way to shop.</h1>
      <h2>Prices and availability</h2>
      <p>
        All prices are in Nigerian Naira. An original price may be shown beside
        a discounted price, with a calculated percentage saving. Daily deals
        have a closing time; expired deal pricing is recalculated before
        payment. Product availability and the final delivery fee are checked by
        the store before opening payment.
      </p>
      <h2>Checkout and payment</h2>
      <p>
        Give a complete delivery address and a working Nigerian phone number.
        Live payments are processed securely through Paystack. An order is
        confirmed only after the store verifies payment. Stock reservations last
        30 minutes; late payments may require availability review.
      </p>
      <h2>Delivery and returns</h2>
      <p>
        Delivery charges are shown in your order summary before you pay. Read
        the{" "}
        <Link href="/help#delivery" className="underline">
          delivery information
        </Link>{" "}
        and{" "}
        <Link href="/help#returns" className="underline">
          returns guidance
        </Link>{" "}
        for more details. Keep your order reference for any delivery or product
        enquiries.
      </p>
      <h2>The demo experience</h2>
      <p>
        The demo storefront contains illustrative products, prices and ratings.
        A demo order is a browser preview of the checkout flow. It does not take
        money, send an email, place a real fulfilment order or promise delivery.
      </p>
    </article>
  );
}
