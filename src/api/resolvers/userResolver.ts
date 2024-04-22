import {GraphQLError} from 'graphql';
import {Cat, LoginUser, User, UserInput, UserOutput} from '../../types/DBTypes';
import fetchData from '../../functions/fetchData';
import {LoginResponse, UserResponse} from '../../types/MessageTypes';
import {MyContext} from '../../types/MyContext';

// TODO: create resolvers based on user.graphql
// note: when updating or deleting a user don't send id to the auth server, it will get it from the token. So token needs to be sent with the request to the auth server
// note2: when updating or deleting a user as admin, you need to send user id (dont delete admin btw) and also check if the user is an admin by checking the role from the user object form context

export default {
  Cat: {
    owner: async (parent: Cat): Promise<UserOutput> => {
      if (!process.env.AUTH_URL) {
        throw new GraphQLError('No auth url set in .env file');
      }
      const user = await fetchData<User>(
        process.env.AUTH_URL + '/users/' + parent.owner,
      );
      user.id = user._id;
      return user;
    },
  },
  Query: {
    users: async () => {
      if (!process.env.AUTH_URL) {
        throw new GraphQLError('No auth url set in .env file');
      }
      const users = await fetchData<User[]>(process.env.AUTH_URL + '/users');
      users.forEach((user) => {
        user.id = user._id;
      });
      return users;
    },
    userById: async (_parent: undefined, args: {id: string}) => {
      if (!process.env.AUTH_URL) {
        throw new GraphQLError('No auth url set in .env file');
      }
      const user = await fetchData<User>(
        process.env.AUTH_URL + '/users/' + args.id,
      );
      user.id = user._id;
      return user;
    },
    checkToken: async (
      _parent: undefined,
      _args: undefined,
      context: MyContext,
    ) => {
      const response = {
        message: 'Token is valid',
        user: context.userdata,
      };
      return response;
    },
  },
  Mutation: {
    register: async (_parent: undefined, args: {user: Omit<User, 'role'>}) => {
      if (!process.env.AUTH_URL) {
        throw new GraphQLError('No auth url set in .env file');
      }
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args.user),
      };
      const registerResponse = await fetchData<UserResponse & {data: User}>(
        process.env.AUTH_URL + '/users',
        options,
      );
      if (!registerResponse.message) {
        registerResponse.message = 'User registered successfully';
      }
      return {user: registerResponse.data, message: registerResponse.message};
    },
    login: async (
      _parent: undefined,
      args: {credentials: {email: string; password: string}},
    ): Promise<LoginResponse & {token: string; user: LoginUser}> => {
      if (!process.env.AUTH_URL) {
        throw new GraphQLError('No auth url set in .env file');
      }
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args.credentials),
      };
      const loginResponse = await fetchData<
        LoginResponse & {token: string; user: LoginUser}
      >(process.env.AUTH_URL + '/auth/login', options);
      loginResponse.user.id = loginResponse.user._id;
      return loginResponse;
    },
    updateUser: async (
      _parent: undefined,
      args: {user: UserInput},
      context: MyContext,
    ): Promise<UserResponse> => {
      if (!context.userdata) {
        throw new GraphQLError('User not authenticated', {
          extensions: {code: 'UNAUTHENTICATED'},
        });
      }
      const options = {
        method: 'PUT',
        headers: {
          'CONTENT-TYPE': 'application/json',
          Authorization: 'Bearer ' + context.userdata.token,
        },
        body: JSON.stringify(args.user),
      };
      const user = await fetchData<UserResponse>(
        process.env.AUTH_URL + '/users',
        options,
      );
      return user;
    },
    deleteUser: async (
      _parent: undefined,
      _args: undefined,
      context: MyContext,
    ): Promise<UserResponse> => {
      if (!context.userdata) {
        throw new GraphQLError('User not authenticated', {
          extensions: {code: 'UNAUTHENTICATED'},
        });
      }
      const options = {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + context.userdata.token,
        },
      };
      const user = await fetchData<UserResponse>(
        process.env.AUTH_URL + '/users',
        options,
      );
      return user;
    },
    deleteUserAsAdmin: async (
      _parent: undefined,
      args: {id: string},
      context: MyContext,
    ): Promise<UserResponse> => {
      if (!context.userdata) {
        throw new GraphQLError('User not authenticated', {
          extensions: {code: 'UNAUTHENTICATED'},
        });
      }
      if (context.userdata.user.role !== 'admin') {
        throw new GraphQLError('User not authorized', {
          extensions: {code: 'UNAUTHORIZED'},
        });
      }
      const options = {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + context.userdata.token,
        },
      };
      const user = await fetchData<UserResponse>(
        process.env.AUTH_URL + `/users/${args.id}`,
        options,
      );
      return user;
    },
  },
};
