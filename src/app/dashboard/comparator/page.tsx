import { redirect } from 'next/navigation';

// Comparator consolidated into Simulator — redirect for any hardcoded/external links
export default function ComparatorPage() {
    redirect('/dashboard/simulator');
}
