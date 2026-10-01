"use client";
import Link from "next/link";
import { CreditCard, PackageCheck, RotateCcw, Truck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
export function HelpPage() {
  const groups = [
    {
      id: "delivery",
      title: "From our store to your doorstep.",
      icon: Truck,
      items: [
        [
          "Where do you deliver?",
          "Checkout supports every Nigerian state and the Federal Capital Territory. Enter your full address, city, state, and Nigerian phone number so your delivery details are complete.",
        ],
        [
          "How much does delivery cost?",
          "Delivery is free on orders of ₦100,000 or more. Below that, delivery is ₦2,500 in Lagos, ₦3,500 in Ogun, Oyo, Osun, Ondo and Ekiti, and ₦5,000 elsewhere. Your exact total is shown before you pay.",
        ],
        [
          "Can I add delivery instructions?",
          "Yes. Add a landmark, access instructions, preferred clothing or shoe sizes, and any useful details in the order notes at checkout.",
        ],
      ],
    },
    {
      id: "payments",
      title: "Your payment, protected.",
      icon: CreditCard,
      items: [
        [
          "How can I pay?",
          "When the live payment service is connected, Paystack supports debit cards, bank transfer and USSD. Your checkout opens on Paystack's secure payment page. The demo store uses a clearly marked sample order and takes no payment.",
        ],
        [
          "When is my order confirmed?",
          "Only after the server verifies a successful payment and matches the currency, amount, email and payment reference with your order. Your browser returning from Paystack alone does not confirm the payment.",
        ],
        [
          "What if I paid but don't see a confirmation?",
          "Use 'Check payment again' on the receipt screen. Paystack also notifies the store independently, so payment can be confirmed even if you close your browser. Use the same browser for a guest receipt or sign in for your account orders.",
        ],
      ],
    },
    {
      id: "orders",
      title: "Your good finds, kept close.",
      icon: PackageCheck,
      items: [
        [
          "Do I need an account to shop?",
          "You can browse, save favourites, fill your bag, and check out as a guest. A Google account gives you a saved delivery address and protected order history in the live store.",
        ],
        [
          "Will my bag disappear when I sign out?",
          "Your account bag is saved and appears when you sign back into that account. Signing out starts a fresh guest bag. Items you select as a guest carry into your account when you sign in, without duplicating previous selections.",
        ],
        [
          "Where is my confirmation email?",
          "The live store sends the itemized receipt to your checkout email after payment verification. Check your spam folder too. Demo orders do not send real emails.",
        ],
      ],
    },
    {
      id: "returns",
      title: "A little peace of mind.",
      icon: RotateCcw,
      items: [
        [
          "What if an item arrives damaged or incorrect?",
          "Keep your order reference, original packaging, and photographs of the item. Request assistance through the merchant's support channel with those details. The merchant should confirm the return or exchange steps before you send an item back.",
        ],
        [
          "What if I pay after my stock reservation expires?",
          "Stock is reserved for 30 minutes during checkout. If payment arrives after that and stock is unavailable, the order is marked for review so the merchant can arrange fulfilment or a refund. You won't receive a misleading shipping confirmation.",
        ],
      ],
    },
  ];
  return (
    <div className="page-width help-page">
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Help & FAQs</span>
      </div>
      <p className="eyebrow">HERE TO MAKE THINGS EASIER</p>
      <h1>A little help goes a long way.</h1>
      <p className="help-intro">
        Everything you need to know about your next good find.
      </p>
      <div className="help-groups">
        {groups.map((group) => (
          <section className="help-group" id={group.id} key={group.id}>
            <h2>
              <group.icon size={22} strokeWidth={1.3} />
              {group.title}
            </h2>
            <Accordion type="single" collapsible>
              {group.items.map(([question, answer], i) => (
                <AccordionItem value={`${group.id}-${i}`} key={question}>
                  <AccordionTrigger>{question}</AccordionTrigger>
                  <AccordionContent>{answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>
    </div>
  );
}
