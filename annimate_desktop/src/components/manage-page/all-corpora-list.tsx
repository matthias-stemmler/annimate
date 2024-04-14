import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Trash2 } from 'lucide-react';
import { FC } from 'react';

export type AllCorporaListProps = {
  corpusNames: string[];
};

export const AllCorporaList: FC<AllCorporaListProps> = ({ corpusNames }) => (
  <div className="h-full flex flex-col gap-2">
    <Label className="truncate leading-5 mb-2">All corpora</Label>

    <div className="flex-1 border rounded-md overflow-hidden">
      {corpusNames.length === 0 ? (
        <p className="text-center text-muted-foreground mt-4">
          No corpora available
        </p>
      ) : (
        <ScrollArea className="h-full ">
          <ScrollBar orientation="horizontal" />

          {corpusNames.map((corpusName) => (
            <div
              key={corpusName}
              className={
                'flex gap-2 items-center justify-between shadow-[0_1px] shadow-gray-200 pl-4 pr-3 py-1'
              }
            >
              <Label className="w-0 flex-1 truncate leading-5">
                {corpusName}
              </Label>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="text-destructive hover:text-destructive"
                    variant="ghost"
                  >
                    <Trash2 />
                  </Button>
                </TooltipTrigger>

                <TooltipContent>Delete corpus</TooltipContent>
              </Tooltip>
            </div>
          ))}
        </ScrollArea>
      )}
    </div>
  </div>
);
