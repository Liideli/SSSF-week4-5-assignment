/* eslint-disable node/no-extraneous-import */
require('dotenv').config();
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import {ApolloServer} from '@apollo/server';
import {expressMiddleware} from '@apollo/server/express4';
import typeDefs from './api/schemas/index';
import resolvers from './api/resolvers/index';
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
} from '@apollo/server/plugin/landingPage/default';
import {notFound, errorHandler} from './middlewares';
import authenticate from './functions/authenticate';
import {makeExecutableSchema} from '@graphql-tools/schema';
import {applyMiddleware} from 'graphql-middleware';
import {MyContext} from './types/MyContext';
import {constraintDirectiveTypeDefs} from 'graphql-constraint-directive';
import {shield} from 'graphql-shield';
import {createRateLimitRule} from 'graphql-rate-limit';

const app = express();

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  }),
);

(async () => {
  try {
    const rateLimitRule = createRateLimitRule({
      identifyContext: (ctx) => {
        return ctx.userdata?._id ? ctx.userdata._id : ctx.id;
      },
    });

    const permissions = shield({
      Mutation: {
        login: rateLimitRule({max: 5, window: '10s'}),
      },
    });

    const executableSchema = makeExecutableSchema({
      typeDefs: [constraintDirectiveTypeDefs, typeDefs],
      resolvers,
    });

    const schema = applyMiddleware(executableSchema, permissions);

    const server = new ApolloServer<MyContext>({
      schema,
      introspection: true,
      plugins: [
        process.env.NODE_ENV === 'production'
          ? ApolloServerPluginLandingPageProductionDefault({
              embed: true as false,
            })
          : ApolloServerPluginLandingPageLocalDefault(),
      ],
      includeStacktraceInErrorResponses: false,
    });
    await server.start();

    app.use(
      '/graphql',
      cors<cors.CorsRequest>(),
      express.json(),
      expressMiddleware(server, {
        context: async ({req}) => authenticate(req),
      }),
    );

    app.use(notFound);
    app.use(errorHandler);
  } catch (error) {
    console.log(error);
  }
})();

export default app;
