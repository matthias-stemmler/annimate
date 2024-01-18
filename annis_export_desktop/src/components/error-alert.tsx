import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { relaunch } from '@/lib/api';
import { AlertCircle } from 'lucide-react';
import { FC } from 'react';

export type ErrorMessageProps = {
  message: string;
};

export const ErrorAlert: FC<ErrorMessageProps> = ({ message }) => (
  <div className="flex items-center h-full">
    <Alert variant="destructive" className="mx-10">
      <AlertCircle className="w-4 h-4" />
      <AlertTitle>Error</AlertTitle>

      <AlertDescription>
        <p>{message}</p>

        <Button
          variant="destructive"
          className="mt-4"
          onClick={() => relaunch().then()}
        >
          Relaunch
        </Button>
      </AlertDescription>
    </Alert>
  </div>
);
