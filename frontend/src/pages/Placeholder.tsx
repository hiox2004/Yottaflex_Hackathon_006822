// Fallback page for unknown URLs.
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export function NotFound() {
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Page not found</CardTitle>
        <CardDescription>This page does not exist.</CardDescription>
      </CardHeader>
      <CardContent>
        <Link to="/" className="text-sm font-medium text-primary hover:underline">
          Back to overview
        </Link>
      </CardContent>
    </Card>
  );
}
