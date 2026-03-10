18:46:28.040 
 348 | export default function RoomsPage() {
18:46:28.040 
 349 |   return (
18:46:28.040 
 350 |     <Suspense fallback={}>
18:46:28.040 
     :      ^^^^^^^^
18:46:28.040 
 351 |       <RoomsPageInner />
18:46:28.040 
 352 |     </Suspense>
18:46:28.040 
 353 |   )
18:46:28.040 
     `----
18:46:28.040 
18:46:28.040 
Caused by:
18:46:28.040 
    Syntax Error
18:46:28.040 
18:46:28.040 
Import trace for requested module:
18:46:28.040 
./app/rooms/page.tsx
18:46:28.041 
18:46:28.050 
18:46:28.051 
> Build failed because of webpack errors
18:46:28.080 
Error: Command "npm run build" exited with 1