import {GraphQLError} from 'graphql';
import catModel from '../models/catModel';
import {Cat, Location} from '../../types/DBTypes';
import {MyContext} from '../../types/MyContext';

// TODO: create resolvers based on cat.graphql
// note: when updating or deleting a cat, you need to check if the user is the owner of the cat
// note2: when updating or deleting a cat as admin, you need to check if the user is an admin by checking the role from the user object
// note3: updating and deleting resolvers should be the same for users and admins. Use if statements to check if the user is the owner or an admin

export default {
  Query: {
    cats: async () => {
      return await catModel.find();
    },
    catById: async (_parent: undefined, args: {id: string}) => {
      const cat = await catModel.findById(args.id);
      if (!cat) {
        throw new GraphQLError('Cat not found', {
          extensions: {code: 'NOT_FOUND'},
        });
      }
      return cat;
    },
    catsByOwner: async (_parent: undefined, args: {ownerId: string}) => {
      const cats = await catModel.find({owner: args.ownerId});
      if (cats.length === 0) {
        throw new GraphQLError('Cat not found', {
          extensions: {code: 'NOT_FOUND'},
        });
      }
      return cats;
    },
    catsByArea: async (
      _parent: undefined,
      args: {topRight: Location; bottomLeft: Location},
    ) => {
      const rightCorner = [args.topRight.lat, args.topRight.lng];
      const leftCorner = [args.bottomLeft.lat, args.bottomLeft.lng];

      const cats = await catModel.find({
        location: {
          $geoWithin: {
            $box: [leftCorner, rightCorner],
          },
        },
      });
      if (cats.length === 0) {
        throw new GraphQLError('Cat not found', {
          extensions: {code: 'NOT_FOUND'},
        });
      }
      return cats;
    },
  },
  Mutation: {
    createCat: async (
      _parent: undefined,
      args: {input: Omit<Cat, '_id'>},
      context: MyContext,
    ) => {
      if (!context.userdata) {
        throw new GraphQLError('User not authenticated', {
          extensions: {code: 'UNAUTHENTICATED'},
        });
      }
      args.input.owner = context.userdata.user._id;
      const newCat = await catModel.create(args.input);
      if (!newCat) {
        throw new Error('Error creating cat');
      }
      return newCat;
    },
    updateCat: async (
      _parent: undefined,
      args: {
        id: string;
        input: Omit<Cat, '_id'>;
      },
      context: MyContext,
    ): Promise<Cat> => {
      if (!context.userdata) {
        throw new GraphQLError('User not authenticated', {
          extensions: {code: 'UNAUTHENTICATED'},
        });
      }
      const filter = {_id: args.id, owner: context.userdata.user._id};
      if (context.userdata.user.role === 'admin') {
        delete filter.owner;
      }
      const updatedCat = await catModel.findOneAndUpdate(filter, args.input, {
        new: true,
      });
      if (!updatedCat) {
        throw new Error('Cat not found');
      }
      return updatedCat;
    },
    deleteCat: async (
      _parent: undefined,
      args: {id: string},
      context: MyContext,
    ): Promise<Cat> => {
      if (!context.userdata) {
        throw new GraphQLError('User not authenticated', {
          extensions: {code: 'UNAUTHENTICATED'},
        });
      }
      const filter = {_id: args.id, owner: context.userdata.user._id};
      if (context.userdata.user.role === 'admin') {
        delete filter.owner;
      }
      const deletedCat = await catModel.findOneAndDelete(filter);
      if (!deletedCat) {
        throw new Error('Cat not found');
      }
      return deletedCat;
    },
  },
};
